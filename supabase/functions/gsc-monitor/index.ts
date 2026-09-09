// Search Console monitor: polls GSC, snapshots, diffs, and creates alerts.
// Invoked by pg_cron every 6h, or manually from the dashboard.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

function gscHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "X-Connection-Api-Key": Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY") ?? "",
    "Content-Type": "application/json",
  };
}

async function gscFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...gscHeaders(), ...(init.headers ?? {}) } });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`GSC ${path} [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (!Deno.env.get("LOVABLE_API_KEY")) throw new Error("LOVABLE_API_KEY is not configured");
    if (!Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY")) throw new Error("Google Search Console connector is not linked");

    const { data: settings } = await supabase.from("gsc_settings").select("*").limit(1).maybeSingle();
    if (!settings?.site_url) {
      return new Response(JSON.stringify({ ok: false, error: "No site configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = settings.site_url as string;
    const encSite = encodeURIComponent(siteUrl);
    const alerts: any[] = [];

    // 1) Search analytics — top 20 queries, last 7 days
    const sa = await gscFetch(`/webmasters/v3/sites/${encSite}/searchAnalytics/query`, {
      method: "POST",
      body: JSON.stringify({
        startDate: isoDaysAgo(7),
        endDate: isoDaysAgo(1),
        dimensions: ["query"],
        rowLimit: 20,
      }),
    });
    const rows = (sa?.rows ?? []) as Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;

    const totals = rows.reduce(
      (a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions, posSum: a.posSum + r.position * r.impressions }),
      { clicks: 0, impressions: 0, posSum: 0 },
    );
    const avgPosition = totals.impressions > 0 ? totals.posSum / totals.impressions : 0;
    const avgCtr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

    // 2) Sitemaps
    let sitemaps: any = { sitemap: [] };
    try { sitemaps = await gscFetch(`/webmasters/v3/sites/${encSite}/sitemaps`); } catch (e) { console.error("sitemaps fetch failed", e); }
    const sitemapList = (sitemaps?.sitemap ?? []) as any[];
    let coverageErrors = 0;
    for (const sm of sitemapList) {
      const errs = Number(sm.errors ?? 0);
      coverageErrors += errs;
      if (settings.alert_sitemap && (errs > 0 || sm.isPending === true)) {
        alerts.push({
          alert_type: "sitemap_issue",
          severity: errs > 0 ? "error" : "warning",
          fingerprint: `${sm.path}:${errs}`,
          title: `Sitemap issue: ${sm.path}`,
          message: errs > 0 ? `${errs} error(s) reported by Google for ${sm.path}.` : `Sitemap ${sm.path} is pending processing.`,
          payload: sm,
        });
      }
    }

    // 3) Insert snapshot
    await supabase.from("gsc_snapshots").insert({
      site_url: siteUrl,
      total_clicks: totals.clicks,
      total_impressions: totals.impressions,
      avg_position: avgPosition,
      avg_ctr: avgCtr,
      coverage_errors: coverageErrors,
      sitemap_status: sitemapList,
      queries: rows,
      raw: { sa, sitemaps },
    });

    // 4) Per-query history + rank-drop diff
    const today = new Date().toISOString().slice(0, 10);
    for (const r of rows) {
      const query = r.keys?.[0];
      if (!query) continue;
      await supabase.from("gsc_query_history").insert({
        site_url: siteUrl, query, position: r.position, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr,
      });

      if (settings.alert_rank_drop) {
        const { data: prev } = await supabase
          .from("gsc_query_history")
          .select("position, recorded_at")
          .eq("site_url", siteUrl).eq("query", query)
          .lt("recorded_at", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
          .order("recorded_at", { ascending: false }).limit(1).maybeSingle();
        if (prev && r.impressions >= (settings.min_impressions ?? 50)) {
          const drop = r.position - Number(prev.position);
          if (drop >= (settings.rank_drop_threshold ?? 3) || (Number(prev.position) <= 10 && r.position > 10)) {
            alerts.push({
              alert_type: "rank_drop",
              severity: "warning",
              fingerprint: `${query}:${today}`,
              title: `Rank drop for "${query}"`,
              message: `Position fell from ${Number(prev.position).toFixed(1)} to ${r.position.toFixed(1)}.`,
              payload: { query, from: prev.position, to: r.position, impressions: r.impressions },
            });
          }
        }
      }
    }

    // 5) Traffic drop vs previous snapshot
    if (settings.alert_traffic_drop) {
      const { data: prevSnap } = await supabase
        .from("gsc_snapshots").select("total_clicks, total_impressions, created_at")
        .eq("site_url", siteUrl)
        .order("created_at", { ascending: false }).range(1, 1).maybeSingle();
      if (prevSnap && Number(prevSnap.total_impressions) >= (settings.min_impressions ?? 50)) {
        const pct = Number(settings.traffic_drop_pct ?? 30);
        const impDrop = ((Number(prevSnap.total_impressions) - totals.impressions) / Number(prevSnap.total_impressions)) * 100;
        const clkDrop = Number(prevSnap.total_clicks) > 0
          ? ((Number(prevSnap.total_clicks) - totals.clicks) / Number(prevSnap.total_clicks)) * 100 : 0;
        if (impDrop >= pct || clkDrop >= pct) {
          alerts.push({
            alert_type: "traffic_drop",
            severity: "warning",
            fingerprint: `${today}:${Math.round(Math.max(impDrop, clkDrop))}`,
            title: `Traffic drop detected`,
            message: `Impressions ${impDrop.toFixed(0)}% / clicks ${clkDrop.toFixed(0)}% vs previous check.`,
            payload: { impDrop, clkDrop, prev: prevSnap, current: { clicks: totals.clicks, impressions: totals.impressions } },
          });
        }
      }
    }

    // 6) Coverage errors (from sitemap aggregate)
    if (settings.alert_coverage && coverageErrors > 0) {
      alerts.push({
        alert_type: "coverage_error",
        severity: "error",
        fingerprint: `${today}:${coverageErrors}`,
        title: `Coverage errors detected`,
        message: `${coverageErrors} indexing error(s) reported across sitemaps.`,
        payload: { coverageErrors },
      });
    }

    // 7) Persist alerts (dedup via unique constraint) and fan out notifications
    const inserted: any[] = [];
    for (const a of alerts) {
      const { data, error } = await supabase.from("gsc_alerts").insert({ site_url: siteUrl, ...a }).select().maybeSingle();
      if (!error && data) inserted.push(data);
    }

    if (inserted.length > 0) {
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      for (const admin of admins ?? []) {
        for (const a of inserted) {
          await supabase.rpc("create_notification", {
            p_user_id: admin.user_id,
            p_title: a.title,
            p_message: a.message,
            p_type: a.severity === "error" ? "error" : "warning",
            p_action_url: "/seo",
            p_metadata: { alert_id: a.id, alert_type: a.alert_type },
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, snapshot: { totals, avgPosition, avgCtr, coverageErrors }, alerts: inserted.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gsc-monitor error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

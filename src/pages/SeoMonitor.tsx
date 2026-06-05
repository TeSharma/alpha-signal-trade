import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertTriangle, TrendingDown, FileWarning, CheckCircle2, ShieldOff } from "lucide-react";

type Settings = {
  id: string;
  site_url: string;
  recipient_email: string | null;
  alert_coverage: boolean;
  alert_sitemap: boolean;
  alert_rank_drop: boolean;
  alert_traffic_drop: boolean;
  rank_drop_threshold: number;
  traffic_drop_pct: number;
  min_impressions: number;
};

type Snapshot = {
  id: string;
  created_at: string;
  total_clicks: number;
  total_impressions: number;
  avg_position: number;
  avg_ctr: number;
  coverage_errors: number;
  queries: any;
  sitemap_status: any;
};

type Alert = {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
};

export default function SeoMonitor() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) { setIsAdmin(false); return; }
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const admin = (roleRows ?? []).some((r: any) => r.role === "admin");
    setIsAdmin(admin);
    if (!admin) return;

    const [{ data: s }, { data: sn }, { data: al }] = await Promise.all([
      supabase.from("gsc_settings").select("*").limit(1).maybeSingle(),
      supabase.from("gsc_snapshots").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("gsc_alerts").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setSettings(s as any);
    setSnap(sn as any);
    setAlerts((al as any) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("gsc-monitor", { body: { source: "manual" } });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "Run failed");
      toast.success(`Scan complete · ${data?.alerts ?? 0} new alert(s)`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to run scan");
    } finally {
      setRunning(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("gsc_settings").update({
      site_url: settings.site_url,
      recipient_email: settings.recipient_email,
      alert_coverage: settings.alert_coverage,
      alert_sitemap: settings.alert_sitemap,
      alert_rank_drop: settings.alert_rank_drop,
      alert_traffic_drop: settings.alert_traffic_drop,
      rank_drop_threshold: Number(settings.rank_drop_threshold),
      traffic_drop_pct: Number(settings.traffic_drop_pct),
      min_impressions: Number(settings.min_impressions),
    }).eq("id", settings.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  }

  async function resolveAlert(id: string) {
    const { error } = await supabase.from("gsc_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Alert resolved"); load(); }
  }

  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Admin access required</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            This page is restricted to administrators. Ask an admin to grant your account the <code>admin</code> role.
          </CardContent>
        </Card>
      </div>
    );
  }

  const queries: any[] = Array.isArray(snap?.queries) ? snap!.queries : [];
  const sitemaps: any[] = Array.isArray(snap?.sitemap_status) ? snap!.sitemap_status : [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Search Console Monitor</h1>
            <p className="text-muted-foreground text-sm mt-1">Automated rank, coverage & traffic checks every 6 hours.</p>
          </div>
          <Button onClick={runNow} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Run scan now
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Clicks (7d)" value={snap?.total_clicks ?? 0} />
          <StatCard label="Impressions (7d)" value={snap?.total_impressions ?? 0} />
          <StatCard label="Avg position" value={snap?.avg_position ? Number(snap.avg_position).toFixed(1) : "—"} />
          <StatCard label="Coverage errors" value={snap?.coverage_errors ?? 0} tone={(snap?.coverage_errors ?? 0) > 0 ? "danger" : "ok"} />
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Active alerts</CardTitle></CardHeader>
          <CardContent>
            {alerts.filter(a => !a.resolved_at).length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> No active alerts.</div>
            ) : (
              <ul className="space-y-2">
                {alerts.filter(a => !a.resolved_at).map(a => (
                  <li key={a.id} className="flex items-start justify-between gap-4 border rounded-md p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={a.severity === "error" ? "destructive" : "secondary"}>{a.alert_type}</Badge>
                        <span className="font-medium">{a.title}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{a.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => resolveAlert(a.id)}>Resolve</Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Top 20 queries</CardTitle></CardHeader>
            <CardContent>
              {queries.length === 0 ? <p className="text-sm text-muted-foreground">No data yet. Run a scan.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground">
                      <th className="py-2">Query</th><th>Pos</th><th>Clicks</th><th>Impr</th>
                    </tr></thead>
                    <tbody>
                      {queries.map((q, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-2 max-w-[220px] truncate">{q.keys?.[0]}</td>
                          <td>{Number(q.position).toFixed(1)}</td>
                          <td>{q.clicks}</td>
                          <td>{q.impressions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileWarning className="w-4 h-4" /> Sitemaps</CardTitle></CardHeader>
            <CardContent>
              {sitemaps.length === 0 ? <p className="text-sm text-muted-foreground">No sitemaps registered in Search Console.</p> : (
                <ul className="space-y-2 text-sm">
                  {sitemaps.map((sm, i) => (
                    <li key={i} className="border rounded p-2">
                      <div className="font-mono text-xs truncate">{sm.path}</div>
                      <div className="text-xs text-muted-foreground">
                        errors: {sm.errors ?? 0} · warnings: {sm.warnings ?? 0} · type: {sm.type ?? "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!settings ? <Loader2 className="animate-spin" /> : (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Site URL (must match Search Console property)</Label>
                    <Input value={settings.site_url} onChange={e => setSettings({ ...settings, site_url: e.target.value })} />
                  </div>
                  <div>
                    <Label>Recipient email (for future email alerts)</Label>
                    <Input value={settings.recipient_email ?? ""} onChange={e => setSettings({ ...settings, recipient_email: e.target.value })} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Toggle label="Coverage errors" v={settings.alert_coverage} onChange={v => setSettings({ ...settings, alert_coverage: v })} />
                  <Toggle label="Sitemap issues" v={settings.alert_sitemap} onChange={v => setSettings({ ...settings, alert_sitemap: v })} />
                  <Toggle label="Rank drops" v={settings.alert_rank_drop} onChange={v => setSettings({ ...settings, alert_rank_drop: v })} />
                  <Toggle label="Traffic drops" v={settings.alert_traffic_drop} onChange={v => setSettings({ ...settings, alert_traffic_drop: v })} />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <Num label="Rank drop threshold (positions)" v={settings.rank_drop_threshold} onChange={n => setSettings({ ...settings, rank_drop_threshold: n })} />
                  <Num label="Traffic drop %" v={settings.traffic_drop_pct} onChange={n => setSettings({ ...settings, traffic_drop_pct: n })} />
                  <Num label="Min impressions (noise filter)" v={settings.min_impressions} onChange={n => setSettings({ ...settings, min_impressions: n })} />
                </div>
                <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: any; tone?: "ok" | "danger" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between border rounded p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={v} onCheckedChange={onChange} />
    </div>
  );
}

function Num({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={v} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

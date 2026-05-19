# Search Console Monitoring & Alerts

Poll Google Search Console every 6 hours, store snapshots, detect issues, and notify via email + in-app.

## What gets monitored

1. **Coverage errors** — new URLs with errors (not found, server error, blocked)
2. **Sitemap issues** — sitemap fetch errors or warnings
3. **Rank drops** — position drop ≥ 3 places (or out of top 10) for top 20 queries vs prior snapshot
4. **Traffic drops** — day-over-day drop > 30% in clicks or impressions

## Architecture

```text
pg_cron (every 6h)
   └─► edge fn: gsc-monitor
          ├─ GET searchanalytics (top 20 queries, last 7d)
          ├─ GET sitemaps status
          ├─ GET urlInspection samples / errors
          ├─ Compare vs previous snapshot in DB
          ├─ Insert into gsc_snapshots / gsc_alerts
          └─ For each new alert:
                ├─ insert into notifications (in-app)
                └─ invoke send-transactional-email
```

## Database (new tables)

- `gsc_snapshots` — timestamped JSON snapshot of queries, coverage, sitemaps
- `gsc_query_history` — per-query position/clicks/impressions over time (for rank charts)
- `gsc_alerts` — generated alerts (type, severity, payload, resolved_at)
- `gsc_settings` — site URL, recipient email, thresholds, enabled toggles

All admin-only via existing `has_role` RLS pattern.

## Edge functions

- `gsc-monitor` — polling + diff + alerting (called by cron + manual button)
- `gsc-fetch` — on-demand fetch for the dashboard UI (search analytics, sitemaps)

Both proxy through `https://connector-gateway.lovable.dev/google_search_console` using `LOVABLE_API_KEY` + `GOOGLE_SEARCH_CONSOLE_API_KEY`.

## Email

Use Lovable Emails (built-in). Requires email domain setup. Single template `gsc-alert` with dynamic data (alert type, details, link to dashboard).

## UI (new page `/seo`, admin-gated)

- Summary cards: indexed pages, coverage errors, avg position, total clicks (last 7d vs prior 7d)
- Rank table: top 20 queries with position trend sparkline
- Coverage panel: errors list
- Sitemap panel: status, last submitted
- Alert history with resolve action
- Settings: recipient email, thresholds, enable/disable each alert type

Link added to Sidebar under admin section.

## Setup steps (execution order)

1. Create DB tables + RLS migration
2. Set up email domain (dialog if not yet configured) + email infrastructure
3. Scaffold transactional email + create `gsc-alert` template
4. Create `gsc-monitor` and `gsc-fetch` edge functions
5. Schedule `gsc-monitor` via pg_cron every 6h
6. Build `/seo` admin page + Sidebar link
7. Seed `gsc_settings` with the published site URL and the user's email
8. Trigger first run to populate baseline

## Thresholds (defaults, editable in UI)

- Rank drop: ≥ 3 positions or falling out of top 10
- Traffic drop: > 30% DoD on clicks or impressions (min 50 baseline impressions to avoid noise)
- Coverage: any new error URL
- Sitemap: any non-success status

## Notes

- Email domain must be configured before alerts can send — if not set up, I'll surface the setup dialog as the first step.
- Rate-limited via the queue; alerts are deduped on `(alert_type, fingerprint)` so we don't repeat the same issue every 6h.

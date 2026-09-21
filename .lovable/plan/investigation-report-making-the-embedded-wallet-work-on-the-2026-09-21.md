# Investigation report: making the embedded wallet work on the published site

Read-only investigation. Nothing was edited, installed, deployed, or configured. No App IDs, keys, or credentials are reproduced here.

## Headline finding

The published site is missing the wallet App ID for one simple, fixable reason: the value only exists in an `.env` file, and `.env` is excluded from the repository by `.gitignore` (line 2, confirmed). Lovable's build only sees files that are actually in the project, so the wallet code compiles with an empty App ID and the button renders disabled.

This does **not** require Enterprise Build Secrets. Build Secrets exist for *private* credentials used during package installation (e.g. private npm registry tokens). The wallet App ID is a public, client-safe identifier — the same category as the Supabase publishable key, which this project already ships as a plain constant in `src/integrations/supabase/client.ts`.

## Answers to the seven questions

**1. Is there a supported way on Pro to give the published build a browser-exposed build-time value?**
Yes, two, both fully supported on Pro:
- Put the public App ID directly in the project source as a constant (the pattern already used for the Supabase publishable key and the Supabase URL in `vite.config.ts`).
- Or keep reading it from a `VITE_` variable, but make that variable actually part of the project. Lovable expects `.env` to be tracked for `VITE_*` values; here it is explicitly ignored, so that path needs the ignore rule relaxed. That is riskier in this repo, because the local `.env` template also carries deployment and API credentials (`PRIVATE_KEY`, RPC and API keys in `.env.example`) that must never enter the repository. Option one avoids that hazard entirely.

**2. Are there project/deployment/domain/publish settings that set environment variables or response headers?**
No. The exposed project surfaces are: publish state and visibility (currently published, public), the Lovable URL slug, custom domains, and runtime Secrets. Runtime Secrets are delivered to server-side functions only — they are not injected into the browser bundle, so they cannot supply a `VITE_` value. None of these surfaces set response headers.

**3. Can Lovable hosting set CSP / X-Frame response headers for this project?**
Not through any project configuration available here. Hosting manages TLS, caching, and SPA fallback; there is no supported header configuration file or setting. What is achievable in-app:
- A Content-Security-Policy can be declared in `index.html` via `<meta http-equiv="Content-Security-Policy" ...>`. It is honoured by browsers, though a few directives (notably `frame-ancestors` and reporting) are ignored in meta form.
- `X-Frame-Options` cannot be set from HTML at all — it is header-only. Clickjacking protection therefore cannot be fully delivered on current Lovable hosting for this project.
- Caution: a restrictive CSP added via meta must still allow the wallet provider's scripts, iframes, and API endpoints, plus Supabase, price feeds, TradingView, and the Polygon RPC endpoints — otherwise it will break working features. It also must not forbid framing, or the Lovable preview breaks.

**4. Can the published project use a public client-safe App ID through a non-secret mechanism?**
Yes — the source-constant approach in answer 1. It is the intended mechanism for publishable identifiers and requires no secret storage and no plan change.

**5. Does the GitHub-connected project deploy the GitHub commit directly?**
No. Lovable's published build is controlled by Lovable: code changes sync with GitHub, but going live requires an explicit publish/Update. A GitHub push does not by itself change what `shtrader.app` serves. Frontend changes only appear after publishing; backend function and database changes apply immediately.

**6. Exact supported next steps that solve the production wallet configuration**
1. Change the wallet provider code to read the App ID from a committed public constant, with the existing environment variable kept as an optional override for local development.
2. Confirm the disabled-state fallback still behaves correctly when no App ID is present.
3. Typecheck and production build.
4. Publish, then verify on `shtrader.app` that the embedded wallet button is enabled and a wallet is created on login.
5. Separately, in the wallet provider's own dashboard: move the app from development to production mode and add `shtrader.app`, `www.shtrader.app`, and the Lovable preview domain as allowed origins. That step is outside this codebase.
6. Optional hardening: a meta-tag CSP in `index.html`, allow-listing every service the app calls. Recommend introducing it as report-only first if the provider's checklist accepts that, since a wrong directive can blank the site.

**7. If no supported mechanism existed on Pro**
That case does not apply — step 6.1 solves it on Pro. The only genuinely unavailable item is true response headers (`X-Frame-Options`, a real `Content-Security-Policy` header, HSTS tuning). If those become a hard requirement, the least-invasive path is to keep building in Lovable and put a header-capable layer in front: point the custom domain at a CDN/proxy (for example Cloudflare) that adds the headers while still serving the Lovable origin, or deploy the same repository to a host with header configuration and move the domain there. No Enterprise upgrade is needed for the wallet fix.

## Technical notes

- `.gitignore:2` ignores `.env`, and `.env.*` on line 3 — so no environment file reaches the build.
- The sandbox `.env` contains only empty Supabase variables; no wallet App ID is present here, which matches the disabled production button.
- `vite.config.ts` already hardcodes the public Supabase URL and publishable key into `define`, and bundles the wallet SDK into the `web3` chunk — precedent for the constant approach.
- `src/wallet/safePrivy.ts` derives an enabled flag from the build-time value and returns safe defaults when absent; `src/wallet/PrivyWalletProvider.tsx` renders children without the provider in that case. Both stay intact under the proposed change.
- No contracts, oracle feeds, risk engine, market configuration, wallet architecture, or Demo/Live separation are involved.

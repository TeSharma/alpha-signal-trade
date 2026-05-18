# Connect Google Search Console & Submit Sitemap

The Google Search Console connector is now linked to the project. To finish, I'll verify ownership of `https://alpha-signal-trade.lovable.app/` and submit the existing sitemap.

## Steps

1. **Request a META verification token** from Google Site Verification API for `https://alpha-signal-trade.lovable.app/`.
2. **Embed the meta tag** in `index.html` inside `<head>` (e.g. `<meta name="google-site-verification" content="..." />`).
3. **Publish the app** so the meta tag is live on the published URL. *(You'll need to click Publish — verification can only succeed after the new HTML is deployed.)*
4. **Call the verify endpoint** to confirm Google can see the tag.
5. **Add the site** to your Search Console property list via `PUT /webmasters/v3/sites/{encoded-url}`.
6. **Submit the sitemap** at `https://alpha-signal-trade.lovable.app/sitemap.xml` via `PUT /webmasters/v3/sites/{encoded-url}/sitemaps/{encoded-sitemap-url}`.

## Notes

- Site URL used: `https://alpha-signal-trade.lovable.app/` (published domain, not the preview URL).
- Sitemap already exists at `public/sitemap.xml` with 9 routes — no changes needed.
- The only code change is adding one `<meta>` tag in `index.html`.
- Steps 4–6 will be executed via `curl` against the Lovable connector gateway after you publish.

## After approval

I'll fetch the token, add the meta tag, then pause for you to publish before running the verification + sitemap submission.

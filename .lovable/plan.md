# Terms of Service and Privacy Policy pages

Add two public legal pages using the exact text you provided, with no placeholders — every date, email and website reference comes from your text (Last Updated: September 19, 2026; support@shtrader.app; https://shtrader.app).

## Pages

- `/terms` — Terms of Service (your full 23-section text)
- `/privacy` — Privacy Policy (your full 17-section text)

Both are public: reachable without signing in, and live at https://shtrader.app/terms and https://shtrader.app/privacy once published.

## Look

Clean legal-document layout matching the existing site styling:
- Page title, "Last Updated" line
- Numbered sections with clear headings, readable line length, bulleted lists where your text uses them
- Back-to-home link at the top, and a link across to the other document at the bottom
- Contact email shown as a mailto link

## Where they are linked

- Landing page footer: "Terms of Service" and "Privacy Policy"
- Signup page: a short line under the submit button noting that creating an account means accepting the Terms and Privacy Policy, both linked
- Login page: the same two links in the footer area of the form

## Technical notes

- New `src/pages/Terms.tsx` and `src/pages/Privacy.tsx`, lazy-loaded and registered as public routes in `src/App.tsx` alongside `/login` and `/signup`.
- Shared presentational wrapper for both documents (title, last-updated, prose container) to avoid duplicated markup; section content typed as plain structured data so headings and lists render consistently.
- Styling uses existing semantic design tokens only — no hardcoded colors.
- Footer links added in `src/pages/Index.tsx`; auth links in `src/pages/Signup.tsx` and `src/pages/Login.tsx`.
- Per-page document title and meta description set for each legal page so search engines index them properly.
- No changes to contracts, oracle feeds, keeper work, risk engine, trading logic, or Demo/Live behaviour. Phase 2 deployment stays untouched and paused.

## Verification

Typecheck and production build, then confirm both routes render the full text while signed out, and that all footer/auth links navigate correctly.

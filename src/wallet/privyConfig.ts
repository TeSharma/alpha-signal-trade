/**
 * Privy App ID — a PUBLIC, client-safe identifier (never the App Secret).
 *
 * It lives in source, like the Supabase publishable key, so the published
 * build always has it. `VITE_PRIVY_APP_ID` still wins when present, which
 * lets a developer point a local build at a different Privy app.
 */
const FALLBACK_PRIVY_APP_ID = 'cmtutez89038q0djr875h16nt';

export const PRIVY_APP_ID: string =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) || FALLBACK_PRIVY_APP_ID;

export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

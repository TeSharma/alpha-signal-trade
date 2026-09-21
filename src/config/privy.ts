/**
 * Privy App ID — publishable, client-safe identifier (NOT a secret).
 *
 * The published build has no env-var injection, so the ID lives in source with
 * an env override for local/self-hosted builds. No private keys here.
 */
const FALLBACK_PRIVY_APP_ID = 'cmtutez89038q0djr875h16nt';

export const PRIVY_APP_ID: string =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) || FALLBACK_PRIVY_APP_ID;

export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

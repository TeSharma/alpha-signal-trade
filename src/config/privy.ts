/**
 * Shared public Privy App ID configuration.
 *
 * The Privy App ID is a public client-safe identifier (not a secret), so a
 * production fallback is bundled here for hosts that do not inject
 * VITE_PRIVY_APP_ID into the build (e.g. Lovable without Build Secrets).
 *
 * Precedence: build-time env value wins when present; otherwise the bundled
 * public fallback keeps the existing embedded-wallet implementation working.
 */

const envAppId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

const FALLBACK_PRIVY_APP_ID = 'cmtutez89038q0djr875h16nt';

export const PRIVY_APP_ID: string =
  (typeof envAppId === 'string' && envAppId.length > 0 ? envAppId : FALLBACK_PRIVY_APP_ID).trim();

export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

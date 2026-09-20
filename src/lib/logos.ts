/**
 * ShTrader brand asset registry — the single source of truth for every logo and
 * icon reference in the app.
 *
 * Production assets live in `public/lovable-uploads/` and are served from the
 * site root, e.g. `/lovable-uploads/logo-full.svg`.
 *
 * Ink colourway convention (read from the SVG source):
 *   logo-full.svg / logo-wordmark.svg        ink #F8FAFC (near-white) → DARK surfaces
 *   logo-full-light.svg / *-light.svg        ink #0B1220 (navy)       → LIGHT surfaces
 *   logo-symbol.svg                          blue + gold brand mark
 *   logo-symbol-white|black|gold.svg         monochrome marks
 *
 * `public/favicon.ico` is byte-identical to `lovable-uploads/favicon.ico` and is
 * kept at the site root because browsers request `/favicon.ico` by default.
 */

export const BRAND_NAME = 'ShTrader';
export const BRAND_TAGLINE = 'Empowering Forex Traders';
export const BRAND_PILLARS = ['TRADE', 'LEARN', 'EARN', 'OWN'] as const;

/** Public directory holding the production brand assets. */
export const BRAND_ASSET_DIR = '/lovable-uploads';

/** Background a logo is placed on — selects the correct ink colourway. */
export type BrandSurface = 'light' | 'dark';

export const LOGO_ASSETS = {
  /* ---- Symbol (mark only) ---- */
  symbol: `${BRAND_ASSET_DIR}/logo-symbol.svg`,
  symbolWhite: `${BRAND_ASSET_DIR}/logo-symbol-white.svg`,
  symbolBlack: `${BRAND_ASSET_DIR}/logo-symbol-black.svg`,
  symbolGold: `${BRAND_ASSET_DIR}/logo-symbol-gold.svg`,
  symbolPng192: `${BRAND_ASSET_DIR}/logo-symbol-192.png`,
  symbolPng512: `${BRAND_ASSET_DIR}/logo-symbol-512.png`,
  symbolPng1024: `${BRAND_ASSET_DIR}/logo-symbol-1024.png`,

  /* ---- Wordmark (mark + "ShTrader") ---- */
  wordmark: `${BRAND_ASSET_DIR}/logo-wordmark.svg`,
  wordmarkLight: `${BRAND_ASSET_DIR}/logo-wordmark-light.svg`,
  wordmarkPng: `${BRAND_ASSET_DIR}/logo-wordmark.png`,

  /* ---- Full lockup (mark + name + tagline + pillars) ---- */
  full: `${BRAND_ASSET_DIR}/logo-full.svg`,
  fullLight: `${BRAND_ASSET_DIR}/logo-full-light.svg`,
  fullPng: `${BRAND_ASSET_DIR}/logo-full.png`,
  fullLightPng: `${BRAND_ASSET_DIR}/logo-full-light.png`,

  /* ---- Favicon / app icons ---- */
  faviconSvg: `${BRAND_ASSET_DIR}/favicon.svg`,
  faviconIco: '/favicon.ico',
  faviconPng16: `${BRAND_ASSET_DIR}/favicon-16.png`,
  faviconPng32: `${BRAND_ASSET_DIR}/favicon-32.png`,
  faviconPng48: `${BRAND_ASSET_DIR}/favicon-48.png`,
  appIcon192: `${BRAND_ASSET_DIR}/logo-symbol-192.png`,
  appIcon512: `${BRAND_ASSET_DIR}/logo-symbol-512.png`,
} as const;

/**
 * Reserved for the future Dynamic Logo system.
 *
 * These SVGs are brand assets only — they are intentionally NOT wired to live
 * market data, AI state, signal state or trading state. Nothing in the app reads
 * this map yet; a future "Dynamic Logo" milestone will map real state onto it.
 */
export const DYNAMIC_LOGO_ASSETS = {
  neutral: `${BRAND_ASSET_DIR}/dynamic-v2/neutral.svg`,
  bullish: `${BRAND_ASSET_DIR}/dynamic-v2/bullish.svg`,
  bearish: `${BRAND_ASSET_DIR}/dynamic-v2/bearish.svg`,
  strongSignal: `${BRAND_ASSET_DIR}/dynamic-v2/strong-signal.svg`,
  highVolatility: `${BRAND_ASSET_DIR}/dynamic-v2/high-volatility.svg`,
  aiAnalyzing: `${BRAND_ASSET_DIR}/dynamic-v2/ai-analyzing.svg`,
  onChain: `${BRAND_ASSET_DIR}/dynamic-v2/on-chain.svg`,
} as const;

export type DynamicLogoState = keyof typeof DYNAMIC_LOGO_ASSETS;
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BRAND_NAME, LOGO_ASSETS, type BrandSurface } from '@/lib/logos';

/**
 * Which slice of the logo lockup to render.
 * - `symbol`   the mark on its own (auth headers, app icons, tight spaces)
 * - `wordmark` mark + "ShTrader"
 * - `full`     full lockup with tagline + pillars (landing hero, sidebar)
 */
export type LogoVariant = 'symbol' | 'wordmark' | 'full';

/** Colourway for the symbol-only variant. */
export type LogoColorway = 'brand' | 'white' | 'black' | 'gold';

interface LogoProps {
  variant?: LogoVariant;
  /**
   * Background the logo sits on. Only the lockups carry ink that depends on it:
   * `light` selects the dark-ink artwork, `dark` the near-white artwork.
   */
  on?: BrandSurface;
  colorway?: LogoColorway;
  /** Force the raster (PNG) export instead of the SVG. */
  raster?: boolean;
  className?: string;
  alt?: string;
}

const SYMBOL_COLORWAYS: Record<LogoColorway, string> = {
  brand: LOGO_ASSETS.symbol,
  white: LOGO_ASSETS.symbolWhite,
  black: LOGO_ASSETS.symbolBlack,
  gold: LOGO_ASSETS.symbolGold,
};

/**
 * Builds a small fallback chain (SVG first, then the matching PNG export) so a
 * missing vector still renders instead of showing a broken image.
 */
function resolveSources(
  variant: LogoVariant,
  on: BrandSurface,
  colorway: LogoColorway,
  raster: boolean,
): string[] {
  if (variant === 'symbol') {
    return [SYMBOL_COLORWAYS[colorway], LOGO_ASSETS.symbolPng512];
  }
  if (variant === 'wordmark') {
    const svg = on === 'light' ? LOGO_ASSETS.wordmarkLight : LOGO_ASSETS.wordmark;
    return raster ? [LOGO_ASSETS.wordmarkPng, svg] : [svg, LOGO_ASSETS.wordmarkPng];
  }
  const svg = on === 'light' ? LOGO_ASSETS.fullLight : LOGO_ASSETS.full;
  const png = on === 'light' ? LOGO_ASSETS.fullLightPng : LOGO_ASSETS.fullPng;
  return raster ? [png, svg] : [svg, png];
}

/**
 * ShTrader logo. Renders the official asset for the surface it sits on and
 * degrades gracefully to the equivalent raster export if a vector is missing.
 */
export function Logo({
  variant = 'full',
  on = 'light',
  colorway = 'brand',
  raster = false,
  className,
  alt,
}: LogoProps) {
  const sources = resolveSources(variant, on, colorway, raster);
  const primary = sources[0];
  const [attempt, setAttempt] = useState(0);

  // Reset the fallback cursor whenever the resolved artwork changes.
  useEffect(() => {
    setAttempt(0);
  }, [primary]);

  const src = sources[Math.min(attempt, sources.length - 1)];

  return (
    <img
      src={src}
      alt={alt ?? BRAND_NAME}
      className={cn('object-contain', className)}
      onError={() => setAttempt((n) => (n < sources.length - 1 ? n + 1 : n))}
      decoding="async"
    />
  );
}

export default Logo;
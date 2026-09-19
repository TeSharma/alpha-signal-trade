import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { DYNAMIC_LOGO_ASSETS, type DynamicLogoState } from '@/lib/logos';
import { Logo } from '@/components/ui/Logo';

export interface DynamicLogoProps {
  /**
   * Which dynamic brand state to display.
   *
   * This is a *brand* state, not a market state: the component renders the
   * matching artwork and nothing else. It performs no market, AI or chain
   * lookups and is deliberately decoupled from live data, so a later milestone
   * can decide how that state gets derived.
   */
  state: DynamicLogoState;
  className?: string;
  alt?: string;
}

const DEFAULT_ALT = 'ShTrader dynamic logo';

/**
 * ShTrader Dynamic Logo — presentational only.
 *
 * Renders the dynamic brand asset for the requested `state` from
 * `DYNAMIC_LOGO_ASSETS`. If that SVG cannot be loaded it degrades gracefully to
 * the static brand mark through the existing `Logo` component, so a missing file
 * shows the ShTrader symbol instead of a broken image.
 *
 * No market-data, AI, blockchain or animation logic lives here by design.
 */
export function DynamicLogo({ state, className, alt = DEFAULT_ALT }: DynamicLogoProps) {
  const src = DYNAMIC_LOGO_ASSETS[state];
  const [failed, setFailed] = useState(false);

  // Re-arm the fallback whenever the resolved asset changes.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return <Logo variant="symbol" alt={alt} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      data-dynamic-logo-state={state}
      className={cn('object-contain', className)}
      onError={() => setFailed(true)}
      decoding="async"
    />
  );
}

export default DynamicLogo;

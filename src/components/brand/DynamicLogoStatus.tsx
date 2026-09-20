import { cn } from '@/lib/utils';
import { DynamicLogo } from '@/components/ui/DynamicLogo';
import { useDynamicLogoState } from '@/hooks/useDynamicLogoState';
import type { DynamicLogoSource } from '@/lib/dynamicLogo/adapters';
import { DYNAMIC_LOGO_PRECEDENCE } from '@/lib/dynamicLogo/types';

/**
 * Dynamic Logo status indicator for the authenticated shell.
 *
 * Purely presentational and strictly read-only: it renders `<DynamicLogo>` for
 * the state derived from whatever existing application state the caller already
 * has, and falls back to the permanent static brand symbol if the dynamic asset
 * fails to load (handled inside `DynamicLogo`).
 *
 * It fetches nothing, subscribes to nothing, and never triggers a wallet prompt
 * or a transaction.
 */
interface DynamicLogoStatusProps {
  /** Existing application state. Omit to render the neutral fallback state. */
  source?: DynamicLogoSource | null;
  className?: string;
  /** Hide the textual state label, keeping only the mark. */
  showLabel?: boolean;
}

export function DynamicLogoStatus({
  source,
  className,
  showLabel = true,
}: DynamicLogoStatusProps) {
  const state = useDynamicLogoState(source);
  const label =
    DYNAMIC_LOGO_PRECEDENCE.find((rule) => rule.state === state)?.label ?? state;

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={`Dynamic logo state: ${label}`}
    >
      <DynamicLogo state={state} className="h-7 w-7" />
      {showLabel && (
        <span className="hidden text-xs text-muted-foreground sm:inline">{label}</span>
      )}
    </div>
  );
}

export default DynamicLogoStatus;

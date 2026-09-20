import { useMemo } from 'react';
import type { DynamicLogoState } from '@/lib/logos';
import {
  buildDynamicLogoInput,
  deriveDynamicLogoState,
  type DynamicLogoSource,
} from '@/lib/dynamicLogo/adapters';
import type { DynamicLogoInput } from '@/lib/dynamicLogo/types';

/**
 * PHASE 3 — React binding for the Dynamic Logo state engine.
 *
 * READ-ONLY consumer of state the caller has already loaded. This hook creates no
 * subscriptions of any kind:
 *
 *   ✗ no Supabase query, no realtime channel, no edge-function call
 *   ✗ no market-data polling, no timers, no effects
 *   ✗ no Web3 provider, no wallet call, no transaction, no chain listener
 *
 * It only maps its `source` argument (existing application state passed in by the
 * component) through the pure adapter and Phase 2 engine, memoised by the values
 * that actually matter.
 */
export function useDynamicLogoState(source?: DynamicLogoSource | null): DynamicLogoState {
  const signal = source?.signal ?? null;
  const volatility = source?.volatility ?? null;
  const aiAnalyzing = source?.aiAnalyzing ?? null;
  const onChainActivity = source?.onChainActivity ?? null;

  return useMemo(
    () => deriveDynamicLogoState({ signal, volatility, aiAnalyzing, onChainActivity }),
    [signal, volatility, aiAnalyzing, onChainActivity],
  );
}

/**
 * Same derivation, but returns the intermediate `DynamicLogoInput` too — used by
 * the development showcase to display source → input → state.
 */
export function useDynamicLogoInput(source?: DynamicLogoSource | null): {
  state: DynamicLogoState;
  input: DynamicLogoInput;
} {
  const signal = source?.signal ?? null;
  const volatility = source?.volatility ?? null;
  const aiAnalyzing = source?.aiAnalyzing ?? null;
  const onChainActivity = source?.onChainActivity ?? null;

  return useMemo(
    () => ({
      input: buildDynamicLogoInput({ signal, volatility, aiAnalyzing, onChainActivity }),
      state: deriveDynamicLogoState({ signal, volatility, aiAnalyzing, onChainActivity }),
    }),
    [signal, volatility, aiAnalyzing, onChainActivity],
  );
}

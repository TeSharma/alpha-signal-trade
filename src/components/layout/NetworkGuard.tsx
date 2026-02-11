import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNetworkEnforcement } from '@/hooks/useNetworkEnforcement';
import { useApp } from '@/contexts/AppContext';

const NetworkGuard = () => {
  const { state } = useApp();
  const { isCorrectNetwork, isWalletConnected, networkName, requiredNetworkName, switchToRequiredNetwork } = useNetworkEnforcement(state.accountMode);

  // Only show when wallet is connected AND on the wrong network
  if (!isWalletConnected || isCorrectNetwork) return null;

  return (
    <div className="w-full bg-amber-500 text-amber-950 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            You are connected to <strong>{networkName}</strong>. Please switch to {requiredNetworkName} to use this dApp.
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={switchToRequiredNetwork}
          className="whitespace-nowrap"
        >
          Switch to {requiredNetworkName}
        </Button>
      </div>
    </div>
  );
};

export default NetworkGuard;

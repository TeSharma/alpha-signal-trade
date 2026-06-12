import React from 'react';
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, ExternalLink } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTronWallet } from "@/hooks/useTronWallet";

const PUBLISHED_URL = "https://alpha-signal-trade.lovable.app";

export const WalletConnectButton = () => {
  const {
    isConnected: ethConnected,
    isConnecting: ethConnecting,
    connectWallet: connectEth,
  } = useWallet();

  const {
    isConnected: tronConnected,
    isConnecting: tronConnecting,
    connectWallet: connectTron,
  } = useTronWallet();

  const isAnyConnected = ethConnected || tronConnected;
  const isAnyConnecting = ethConnecting || tronConnecting;

  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleConnect = () => {
    if (window.ethereum) {
      connectEth();
    } else if (window.tronWeb) {
      connectTron();
    } else {
      alert('Please install MetaMask or TronLink to connect your wallet');
    }
  };

  if (isAnyConnected) {
    return (
      <Button variant="outline" className="w-full" size="sm" disabled>
        <Wallet className="h-4 w-4 mr-2 text-green-600" />
        <span className="text-green-600">Connected</span>
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        size="sm"
        onClick={handleConnect}
        disabled={isAnyConnecting}
      >
        {isAnyConnecting ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </>
        )}
      </Button>
      {inIframe && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Wallets work best on the{' '}
          <a
            href={PUBLISHED_URL}
            target="_top"
            rel="noopener noreferrer"
            className="underline inline-flex items-center gap-0.5"
          >
            published site <ExternalLink className="h-3 w-3" />
          </a>
          . Inside the preview, MetaMask may fail to respond.
        </p>
      )}
    </div>
  );
};

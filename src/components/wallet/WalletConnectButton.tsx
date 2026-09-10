import React, { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, ExternalLink, Sparkles } from "lucide-react";
import { useUnifiedWallet } from "@/wallet";
import { usePrivy } from '@privy-io/react-auth';
import { useTronWallet } from "@/hooks/useTronWallet";
import { useWalletLinkage } from "@/wallet/useWalletLinkage";

const PUBLISHED_URL = "https://alpha-signal-trade.lovable.app";

export const WalletConnectButton = () => {
  const {
    connected: ethConnected,
    isConnecting: ethConnecting,
    connectEmbedded,
    connectInjected,
    address,
    source,
    chainId,
    error,
  } = useUnifiedWallet();
  const { ready: privyReady, authenticated: privyAuthenticated, login: privyLogin } = usePrivy();

  const {
    isConnected: tronConnected,
    isConnecting: tronConnecting,
    connectWallet: connectTron,
  } = useTronWallet();

  const isAnyConnected = ethConnected || tronConnected;
  const isAnyConnecting = ethConnecting || tronConnecting;

  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Link the active EVM wallet to the Supabase user (owner-only RLS).
  const { linkCurrent } = useWalletLinkage(address, source, chainId);
  useEffect(() => {
    if (ethConnected && address) linkCurrent();
  }, [ethConnected, address, linkCurrent]);

  const handleEmbedded = async () => {
    // Privy login creates/recovers the non-custodial embedded wallet.
    if (privyReady && !privyAuthenticated) {
      await privyLogin();
      return;
    }
    await connectEmbedded();
  };

  const handleConnect = () => {
    // Prefer embedded; MetaMask stays available via the secondary button.
    if (!window.ethereum) {
      handleEmbedded();
    } else {
      connectInjected();
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
        onClick={handleEmbedded}
        disabled={isAnyConnecting || !privyReady}
      >
        {isAnyConnecting ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Create / Connect Embedded Wallet
          </>
        )}
      </Button>
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
            Connect MetaMask
          </>
        )}
      </Button>
      {error && <p className="text-[11px] text-destructive leading-snug">{error}</p>}
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

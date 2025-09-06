import React from 'react';
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTronWallet } from "@/hooks/useTronWallet";

export const WalletConnectButton = () => {
  const { 
    isConnected: ethConnected, 
    isConnecting: ethConnecting, 
    connectWallet: connectEth,
    error: ethError
  } = useWallet();
  
  const { 
    isConnected: tronConnected, 
    isConnecting: tronConnecting, 
    connectWallet: connectTron,
    error: tronError
  } = useTronWallet();

  const isAnyConnected = ethConnected || tronConnected;
  const isAnyConnecting = ethConnecting || tronConnecting;
  const hasError = ethError || tronError;

  const handleConnect = () => {
    // Try Ethereum first, then Tron
    if (window.ethereum) {
      connectEth();
    } else if (window.tronWeb) {
      connectTron();
    } else {
      // Show message about installing wallets
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
  );
};
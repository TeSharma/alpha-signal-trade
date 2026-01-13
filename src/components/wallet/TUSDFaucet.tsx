import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, ExternalLink, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Web3 from 'web3';
import { CONTRACT_ADDRESSES, CHAIN_IDS } from '@/config/contracts';
import TUSDFaucetABI from '../../../frontend/abi/TUSDFaucet.json';

const TUSD_ADDRESS = CONTRACT_ADDRESSES.amoy.TokenizedCurrency;
const FAUCET_ADDRESS = CONTRACT_ADDRESSES.amoy.TUSDFaucet;

// Minimal ERC20 ABI for balance check
const TUSD_ABI = [
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const TUSDFaucet: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [canClaim, setCanClaim] = useState(true);
  const [timeUntilClaim, setTimeUntilClaim] = useState(0);
  const [claimAmount, setClaimAmount] = useState('1000');
  const [isTestnet, setIsTestnet] = useState(true);
  const [faucetDeployed, setFaucetDeployed] = useState(false);
  const { toast } = useToast();

  // Check network and faucet status
  const checkNetwork = useCallback(async () => {
    try {
      if (!window.ethereum) return;
      
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdNum = parseInt(chainId, 16);
      
      // Only show faucet on testnet (Amoy)
      setIsTestnet(chainIdNum === CHAIN_IDS.amoy);
      
      // Check if faucet is deployed (has an address)
      setFaucetDeployed(!!FAUCET_ADDRESS && FAUCET_ADDRESS.length > 0);
    } catch (error) {
      console.error('Error checking network:', error);
    }
  }, []);

  const getBalance = useCallback(async () => {
    try {
      if (!window.ethereum) return;
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) return;
      
      const contract = new web3.eth.Contract(TUSD_ABI as any, TUSD_ADDRESS);
      const decimals = await contract.methods.decimals().call() as number;
      const bal = await contract.methods.balanceOf(accounts[0]).call() as bigint;
      
      // Format with correct decimals (tUSD uses 6 decimals)
      const formattedBalance = Number(bal) / Math.pow(10, Number(decimals));
      setBalance(formattedBalance.toFixed(2));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, []);

  const checkClaimStatus = useCallback(async () => {
    try {
      if (!window.ethereum || !faucetDeployed) return;
      
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) return;
      
      const faucet = new web3.eth.Contract(TUSDFaucetABI as any, FAUCET_ADDRESS);
      
      // Check if user can claim
      const canClaimNow = await faucet.methods.canClaim(accounts[0]).call() as boolean;
      setCanClaim(canClaimNow);
      
      // Get time until next claim
      const timeRemaining = await faucet.methods.timeUntilNextClaim(accounts[0]).call() as bigint;
      setTimeUntilClaim(Number(timeRemaining));
      
      // Get claim amount (in wei, convert to tUSD)
      const amount = await faucet.methods.claimAmount().call() as bigint;
      setClaimAmount((Number(amount) / 1e6).toString());
    } catch (error) {
      console.error('Error checking claim status:', error);
    }
  }, [faucetDeployed]);

  const handleClaim = async () => {
    if (!window.ethereum) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your MetaMask wallet first',
        variant: 'destructive'
      });
      return;
    }

    if (!faucetDeployed) {
      toast({
        title: 'Faucet not deployed',
        description: 'The faucet contract has not been deployed yet. Contact admin.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setTxHash(null);

    try {
      const web3 = new Web3(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const accounts = await web3.eth.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Check network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x13882') { // Amoy testnet
        toast({
          title: 'Wrong Network',
          description: 'Please switch to Polygon Amoy testnet',
          variant: 'destructive'
        });
        return;
      }

      const faucet = new web3.eth.Contract(TUSDFaucetABI as any, FAUCET_ADDRESS);
      
      const tx = await faucet.methods.claim().send({
        from: accounts[0]
      });

      setTxHash(tx.transactionHash as string);
      await getBalance();
      await checkClaimStatus();
      
      toast({
        title: 'Tokens claimed!',
        description: `Successfully claimed ${claimAmount} tUSD to your wallet`,
      });
    } catch (error: any) {
      console.error('Claim error:', error);
      
      // Parse specific errors
      if (error.message?.includes('CooldownNotElapsed')) {
        toast({
          title: 'Cooldown active',
          description: 'You must wait 24 hours between claims.',
          variant: 'destructive'
        });
      } else if (error.message?.includes('FaucetPaused')) {
        toast({
          title: 'Faucet paused',
          description: 'The faucet is currently paused. Try again later.',
          variant: 'destructive'
        });
      } else if (error.code === 4001) {
        toast({
          title: 'Transaction cancelled',
          description: 'You cancelled the transaction.',
        });
      } else {
        toast({
          title: 'Claim failed',
          description: error.message || 'Failed to claim tokens',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Format remaining time
  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    checkNetwork();
    getBalance();
    
    // Listen for account/network changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', () => {
        getBalance();
        checkClaimStatus();
      });
      window.ethereum.on('chainChanged', () => {
        checkNetwork();
        getBalance();
        checkClaimStatus();
      });
    }
  }, [checkNetwork, getBalance, checkClaimStatus]);

  useEffect(() => {
    if (faucetDeployed) {
      checkClaimStatus();
    }
  }, [faucetDeployed, checkClaimStatus]);

  // Countdown timer
  useEffect(() => {
    if (timeUntilClaim > 0) {
      const timer = setInterval(() => {
        setTimeUntilClaim(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeUntilClaim === 0 && !canClaim) {
      setCanClaim(true);
    }
  }, [timeUntilClaim, canClaim]);

  // Don't render on mainnet
  if (!isTestnet) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              tUSD Testnet Faucet
            </CardTitle>
            <CardDescription className="mt-1">
              Claim {claimAmount} test tUSD every 24 hours
            </CardDescription>
          </div>
          <Badge variant="outline">Amoy Testnet</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {balance !== null && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Your tUSD Balance</div>
            <div className="text-2xl font-bold">{balance} tUSD</div>
          </div>
        )}

        {/* Faucet not deployed warning */}
        {!faucetDeployed && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Faucet not deployed</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              The faucet contract needs to be deployed. Run:<br />
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                npx hardhat run scripts/deploy-faucet.js --network amoy
              </code>
            </p>
          </div>
        )}

        {/* Claim button with cooldown */}
        <div className="space-y-2">
          {!canClaim && timeUntilClaim > 0 ? (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Next claim available in {formatTimeRemaining(timeUntilClaim)}</span>
              </div>
            </div>
          ) : (
            <Button 
              onClick={handleClaim} 
              disabled={isLoading || !faucetDeployed}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4 mr-2" />
                  Claim {claimAmount} tUSD
                </>
              )}
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Free testnet tokens • One claim per 24 hours
          </p>
        </div>

        {txHash && (
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Tokens claimed!</span>
            </div>
            <a
              href={`https://amoy.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
            >
              View on PolygonScan
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">How to get started:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Connect MetaMask to Polygon Amoy testnet</li>
            <li>Get free MATIC from <a href="https://faucet.polygon.technology/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Polygon Faucet</a></li>
            <li>Claim tUSD from this faucet (1000 tUSD per day)</li>
            <li>Start trading on the Trade page</li>
          </ol>
        </div>

        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              <span className="font-medium">tUSD Contract: </span>
              <a
                href={`https://amoy.polygonscan.com/address/${TUSD_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:underline"
              >
                {TUSD_ADDRESS.slice(0, 10)}...{TUSD_ADDRESS.slice(-8)}
              </a>
            </div>
            {faucetDeployed && (
              <div>
                <span className="font-medium">Faucet Contract: </span>
                <a
                  href={`https://amoy.polygonscan.com/address/${FAUCET_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 hover:underline"
                >
                  {FAUCET_ADDRESS.slice(0, 10)}...{FAUCET_ADDRESS.slice(-8)}
                </a>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TUSDFaucet;

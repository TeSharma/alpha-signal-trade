import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coins, ExternalLink, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import Web3 from 'web3';

const TUSD_ADDRESS = '0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164';

// Minimal ERC20 ABI for minting (if minter role available) or just display
const TUSD_ABI = [
  {
    "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const TUSDFaucet: React.FC = () => {
  const [amount, setAmount] = useState('100');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const { toast } = useToast();

  const getBalance = async () => {
    try {
      if (!window.ethereum) return;
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) return;
      
      const contract = new web3.eth.Contract(TUSD_ABI as any, TUSD_ADDRESS);
      const bal = await contract.methods.balanceOf(accounts[0]).call() as bigint;
      setBalance(web3.utils.fromWei(bal.toString(), 'ether'));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleMint = async () => {
    if (!window.ethereum) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your MetaMask wallet first',
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

      const contract = new web3.eth.Contract(TUSD_ABI as any, TUSD_ADDRESS);
      const amountWei = web3.utils.toWei(amount, 'ether');
      
      const tx = await contract.methods.mint(accounts[0], amountWei).send({
        from: accounts[0]
      });

      setTxHash(tx.transactionHash as string);
      await getBalance();
      
      toast({
        title: 'Tokens minted!',
        description: `Successfully minted ${amount} tUSD to your wallet`,
      });
    } catch (error: any) {
      console.error('Mint error:', error);
      
      // Check if it's a permission error
      if (error.message?.includes('revert') || error.message?.includes('MINTER')) {
        toast({
          title: 'Mint not available',
          description: 'Your address does not have minter permissions. Contact admin to get test tokens.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Mint failed',
          description: error.message || 'Failed to mint tokens',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    getBalance();
  }, []);

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
              Get test tUSD tokens for trading on Polygon Amoy
            </CardDescription>
          </div>
          <Badge variant="outline">Amoy Testnet</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {balance !== null && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Your tUSD Balance</div>
            <div className="text-2xl font-bold">{parseFloat(balance).toFixed(2)} tUSD</div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Amount to mint</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              min="1"
              max="1000"
            />
            <Button onClick={handleMint} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4 mr-2" />
                  Mint
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Max 1000 tUSD per mint. Requires MINTER role.
          </p>
        </div>

        {txHash && (
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Transaction successful!</span>
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
          <p className="font-medium">How to get test tokens:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Connect your MetaMask to Polygon Amoy testnet</li>
            <li>Get free MATIC from <a href="https://faucet.polygon.technology/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Polygon Faucet</a></li>
            <li>Use this faucet to mint tUSD (if you have minter role)</li>
            <li>Or contact admin to receive test tokens</li>
          </ol>
        </div>

        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Contract: </span>
            <a
              href={`https://amoy.polygonscan.com/address/${TUSD_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 hover:underline"
            >
              {TUSD_ADDRESS.slice(0, 10)}...{TUSD_ADDRESS.slice(-8)}
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TUSDFaucet;

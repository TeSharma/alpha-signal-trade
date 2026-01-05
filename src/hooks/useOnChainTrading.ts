import { useState, useCallback } from 'react';
import Web3 from 'web3';
import { useToast } from '@/hooks/use-toast';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_ADDRESSES, TRADING_PLATFORM_ADDRESS } from './useTokenContracts';

// ABIs
const ERC20_ABI = [
  {
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
];

const TRADING_PLATFORM_ABI = [
  {
    inputs: [
      { name: 'pair', type: 'string' },
      { name: 'isLong', type: 'bool' },
      { name: 'collateralAmount', type: 'uint256' },
      { name: 'leverage', type: 'uint256' },
      { name: 'stopLoss', type: 'uint256' },
      { name: 'takeProfit', type: 'uint256' }
    ],
    name: 'openPosition',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'positionId', type: 'uint256' }],
    name: 'closePosition',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'positionId', type: 'uint256' }],
    name: 'getCurrentPnL',
    outputs: [{ name: 'pnl', type: 'int256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'trader', type: 'address' }],
    name: 'getUserPositions',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'positions',
    outputs: [
      { name: 'trader', type: 'address' },
      { name: 'pair', type: 'string' },
      { name: 'isLong', type: 'bool' },
      { name: 'collateral', type: 'uint256' },
      { name: 'leverage', type: 'uint256' },
      { name: 'size', type: 'uint256' },
      { name: 'entryPrice', type: 'int256' },
      { name: 'stopLoss', type: 'uint256' },
      { name: 'takeProfit', type: 'uint256' },
      { name: 'openedAt', type: 'uint256' },
      { name: 'isOpen', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

export interface OpenPositionParams {
  pair: string;
  isLong: boolean;
  collateral: string; // in token units (e.g., "100" for 100 tUSD)
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface OnChainPosition {
  id: number;
  trader: string;
  pair: string;
  isLong: boolean;
  collateral: string;
  leverage: number;
  size: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  openedAt: number;
  isOpen: boolean;
  currentPnL?: string;
}

export const useOnChainTrading = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  const { toast } = useToast();

  const getWeb3AndAccount = async () => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not installed');
    }
    
    const web3 = new Web3(window.ethereum);
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const accounts = await web3.eth.getAccounts();
    
    if (!accounts[0]) {
      throw new Error('No account connected');
    }
    
    return { web3, account: accounts[0] };
  };

  // Check and handle token approval
  const ensureApproval = useCallback(async (
    web3: Web3, 
    account: string, 
    collateralAmount: string
  ): Promise<boolean> => {
    const collateralToken = TOKEN_ADDRESSES.tUSD;
    
    if (collateralToken === '0x0000000000000000000000000000000000000000') {
      toast({
        title: 'Token Not Deployed',
        description: 'Collateral token (tUSD) is not deployed yet',
        variant: 'destructive'
      });
      return false;
    }

    const tokenContract = new web3.eth.Contract(ERC20_ABI as any, collateralToken);
    const decimals: any = await tokenContract.methods.decimals().call();
    const collateralWei = BigInt(Math.floor(parseFloat(collateralAmount) * Math.pow(10, Number(decimals))));
    
    // Check current allowance
    const currentAllowance: any = await tokenContract.methods
      .allowance(account, TRADING_PLATFORM_ADDRESS)
      .call();
    
    if (BigInt(currentAllowance) >= collateralWei) {
      return true; // Already approved
    }
    
    // Need to approve
    setApprovalPending(true);
    toast({
      title: 'Approval Required',
      description: 'Please approve token spending in your wallet',
    });
    
    try {
      await tokenContract.methods
        .approve(TRADING_PLATFORM_ADDRESS, collateralWei.toString())
        .send({ from: account });
      
      toast({
        title: 'Approved',
        description: 'Token spending approved successfully',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Approval Failed',
        description: error.message || 'Failed to approve token spending',
        variant: 'destructive'
      });
      return false;
    } finally {
      setApprovalPending(false);
    }
  }, [toast]);

  // Open position on-chain
  const openPosition = useCallback(async (params: OpenPositionParams): Promise<string | null> => {
    setIsLoading(true);
    
    try {
      const { web3, account } = await getWeb3AndAccount();
      
      // Check token balance
      const collateralToken = TOKEN_ADDRESSES.tUSD;
      const tokenContract = new web3.eth.Contract(ERC20_ABI as any, collateralToken);
      const decimals: any = await tokenContract.methods.decimals().call();
      const balance: any = await tokenContract.methods.balanceOf(account).call();
      
      const collateralWei = BigInt(Math.floor(parseFloat(params.collateral) * Math.pow(10, Number(decimals))));
      
      if (BigInt(balance) < collateralWei) {
        toast({
          title: 'Insufficient Balance',
          description: `You need at least ${params.collateral} tUSD to open this position`,
          variant: 'destructive'
        });
        return null;
      }
      
      // Ensure approval
      const approved = await ensureApproval(web3, account, params.collateral);
      if (!approved) return null;
      
      // Open position
      const tradingContract = new web3.eth.Contract(
        TRADING_PLATFORM_ABI as any, 
        TRADING_PLATFORM_ADDRESS
      );
      
      const stopLossWei = params.stopLoss 
        ? web3.utils.toWei(params.stopLoss.toString(), 'ether') 
        : '0';
      const takeProfitWei = params.takeProfit 
        ? web3.utils.toWei(params.takeProfit.toString(), 'ether') 
        : '0';
      
      const tx = await tradingContract.methods
        .openPosition(
          params.pair,
          params.isLong,
          collateralWei.toString(),
          params.leverage,
          stopLossWei,
          takeProfitWei
        )
        .send({ from: account });
      
      toast({
        title: 'Position Opened',
        description: `On-chain position opened. Tx: ${tx.transactionHash.slice(0, 10)}...`,
      });
      
      return tx.transactionHash;
    } catch (error: any) {
      console.error('Error opening position:', error);
      toast({
        title: 'Transaction Failed',
        description: error.message || 'Failed to open position on-chain',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ensureApproval, toast]);

  // Close position on-chain
  const closePosition = useCallback(async (positionId: number): Promise<string | null> => {
    setIsLoading(true);
    
    try {
      const { web3, account } = await getWeb3AndAccount();
      
      const tradingContract = new web3.eth.Contract(
        TRADING_PLATFORM_ABI as any, 
        TRADING_PLATFORM_ADDRESS
      );
      
      const tx = await tradingContract.methods
        .closePosition(positionId)
        .send({ from: account });
      
      toast({
        title: 'Position Closed',
        description: `Position #${positionId} closed. Tx: ${tx.transactionHash.slice(0, 10)}...`,
      });
      
      return tx.transactionHash;
    } catch (error: any) {
      console.error('Error closing position:', error);
      toast({
        title: 'Transaction Failed',
        description: error.message || 'Failed to close position',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Get user's on-chain positions
  const getUserPositions = useCallback(async (): Promise<OnChainPosition[]> => {
    try {
      const { web3, account } = await getWeb3AndAccount();
      
      const tradingContract = new web3.eth.Contract(
        TRADING_PLATFORM_ABI as any, 
        TRADING_PLATFORM_ADDRESS
      );
      
      const positionIds: any = await tradingContract.methods.getUserPositions(account).call();
      
      if (!positionIds || positionIds.length === 0) {
        return [];
      }
      
      const positions = await Promise.all(
        Array.from(positionIds).map(async (id: any) => {
          const position: any = await tradingContract.methods.positions(id).call();
          
          let currentPnL = '0';
          if (position.isOpen) {
            try {
              const pnl: any = await tradingContract.methods.getCurrentPnL(id).call();
              currentPnL = web3.utils.fromWei(pnl.toString(), 'mwei');
            } catch {
              // PnL calculation might fail if oracle is unavailable
            }
          }
          
          return {
            id: Number(id),
            trader: position.trader,
            pair: position.pair,
            isLong: position.isLong,
            collateral: web3.utils.fromWei(position.collateral.toString(), 'mwei'),
            leverage: Number(position.leverage),
            size: web3.utils.fromWei(position.size.toString(), 'mwei'),
            entryPrice: web3.utils.fromWei(position.entryPrice.toString(), 'ether'),
            stopLoss: web3.utils.fromWei(position.stopLoss.toString(), 'ether'),
            takeProfit: web3.utils.fromWei(position.takeProfit.toString(), 'ether'),
            openedAt: Number(position.openedAt),
            isOpen: position.isOpen,
            currentPnL
          };
        })
      );
      
      return positions;
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  }, []);

  // Get collateral token balance
  const getCollateralBalance = useCallback(async (): Promise<string> => {
    try {
      const { web3, account } = await getWeb3AndAccount();
      
      const collateralToken = TOKEN_ADDRESSES.tUSD;
      if (collateralToken === '0x0000000000000000000000000000000000000000') {
        return '0';
      }
      
      const tokenContract = new web3.eth.Contract(ERC20_ABI as any, collateralToken);
      const balance: any = await tokenContract.methods.balanceOf(account).call();
      const decimals: any = await tokenContract.methods.decimals().call();
      
      return (Number(balance) / Math.pow(10, Number(decimals))).toFixed(2);
    } catch {
      return '0';
    }
  }, []);

  return {
    isLoading,
    approvalPending,
    openPosition,
    closePosition,
    getUserPositions,
    getCollateralBalance
  };
};

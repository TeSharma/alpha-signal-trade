import { useState, useCallback } from 'react';
import Web3 from 'web3';
import { useToast } from '@/hooks/use-toast';

// V2 Contract addresses - will be updated after deployment
export const TRADING_PLATFORM_V2_ADDRESS = '0x0000000000000000000000000000000000000000';
export const PRICE_ORACLE_V2_ADDRESS = '0x0000000000000000000000000000000000000000';
export const TUSD_ADDRESS = '0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164';

// TradingPlatformV2 ABI
const TRADING_PLATFORM_V2_ABI = [
  {
    inputs: [
      { name: 'pairId', type: 'bytes32' },
      { name: 'margin', type: 'uint256' },
      { name: 'leverage', type: 'uint256' },
      { name: 'isLong', type: 'bool' }
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
    name: 'liquidate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'positionId', type: 'uint256' }],
    name: 'getPosition',
    outputs: [
      {
        components: [
          { name: 'trader', type: 'address' },
          { name: 'pairId', type: 'bytes32' },
          { name: 'margin', type: 'uint256' },
          { name: 'leverage', type: 'uint256' },
          { name: 'entryPrice', type: 'uint256' },
          { name: 'liquidationPrice', type: 'uint256' },
          { name: 'isLong', type: 'bool' },
          { name: 'isOpen', type: 'bool' },
          { name: 'openedAt', type: 'uint256' },
          { name: 'closedAt', type: 'uint256' }
        ],
        name: '',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserPositions',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserOpenPositions',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'positionId', type: 'uint256' }],
    name: 'getCurrentPnL',
    outputs: [{ name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'maxLeverage',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'maintenanceMarginBps',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'maxProfitBps',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
];

// ERC20 ABI for approval
const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
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

// Pair ID mapping (keccak256 hashes)
export const PAIR_IDS: Record<string, string> = {
  'EUR/USD': '',
  'GBP/USD': '',
  'USD/JPY': '',
  'AUD/USD': '',
  'USD/CAD': '',
  'USD/CHF': '',
  'NZD/USD': '',
};

// Helper to compute pair ID
export const computePairId = (pair: string): string => {
  if (typeof window !== 'undefined' && window.ethereum) {
    const web3 = new Web3(window.ethereum);
    return web3.utils.keccak256(pair);
  }
  return '';
};

// Initialize pair IDs
const initPairIds = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    const web3 = new Web3(window.ethereum);
    Object.keys(PAIR_IDS).forEach((pair) => {
      PAIR_IDS[pair] = web3.utils.keccak256(pair);
    });
  }
};

export interface OpenPositionV2Params {
  pair: string;
  direction: 'buy' | 'sell';
  margin: string; // Amount in tUSD
  leverage: number;
}

export interface PositionV2 {
  id: number;
  trader: string;
  pairId: string;
  pair: string;
  margin: string;
  leverage: number;
  entryPrice: string;
  liquidationPrice: string;
  isLong: boolean;
  isOpen: boolean;
  openedAt: number;
  closedAt: number;
  currentPnL?: string;
}

export interface PlatformConfig {
  maxLeverage: number;
  maintenanceMarginBps: number;
  maxProfitBps: number;
}

export const useOnChainTradingV2 = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  const { toast } = useToast();

  const getWeb3AndAccount = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not installed');
    }
    const web3 = new Web3(window.ethereum);
    const accounts = await web3.eth.requestAccounts();
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }
    // Initialize pair IDs
    initPairIds();
    return { web3, account: accounts[0] };
  }, []);

  const getTradingContract = useCallback((web3: Web3) => {
    return new web3.eth.Contract(TRADING_PLATFORM_V2_ABI as any, TRADING_PLATFORM_V2_ADDRESS);
  }, []);

  const getCollateralContract = useCallback((web3: Web3) => {
    return new web3.eth.Contract(ERC20_ABI as any, TUSD_ADDRESS);
  }, []);

  // Check and request approval for collateral
  const ensureApproval = async (
    web3: Web3,
    account: string,
    marginAmount: string
  ): Promise<boolean> => {
    const collateralContract = getCollateralContract(web3);
    const marginWei = web3.utils.toWei(marginAmount, 'mwei'); // 6 decimals

    try {
      const currentAllowance = await collateralContract.methods
        .allowance(account, TRADING_PLATFORM_V2_ADDRESS)
        .call();

      if (BigInt(currentAllowance as unknown as string) >= BigInt(marginWei)) {
        return true;
      }

      setApprovalPending(true);
      toast({
        title: 'Approval Required',
        description: 'Please approve tUSD spending in MetaMask',
      });

      // Approve max uint256 for convenience
      const maxApproval = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      await collateralContract.methods
        .approve(TRADING_PLATFORM_V2_ADDRESS, maxApproval)
        .send({ from: account });

      toast({
        title: 'Approval Successful',
        description: 'tUSD spending approved',
      });

      return true;
    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        title: 'Approval Failed',
        description: error.message || 'Failed to approve tUSD',
        variant: 'destructive',
      });
      return false;
    } finally {
      setApprovalPending(false);
    }
  };

  // Get collateral balance
  const getCollateralBalance = async (): Promise<string> => {
    try {
      const { web3, account } = await getWeb3AndAccount();
      const collateralContract = getCollateralContract(web3);
      const balance = await collateralContract.methods.balanceOf(account).call() as unknown as string;
      return web3.utils.fromWei(balance, 'mwei');
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0';
    }
  };

  // Get platform configuration
  const getPlatformConfig = async (): Promise<PlatformConfig | null> => {
    try {
      const { web3 } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      const [maxLeverage, maintenanceMarginBps, maxProfitBps] = await Promise.all([
        contract.methods.maxLeverage().call(),
        contract.methods.maintenanceMarginBps().call(),
        contract.methods.maxProfitBps().call(),
      ]);

      return {
        maxLeverage: Number(maxLeverage),
        maintenanceMarginBps: Number(maintenanceMarginBps),
        maxProfitBps: Number(maxProfitBps),
      };
    } catch (error) {
      console.error('Error fetching platform config:', error);
      return null;
    }
  };

  // Open a new position
  const openPosition = async (params: OpenPositionV2Params): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { web3, account } = await getWeb3AndAccount();
      
      // Validate pair
      const pairId = PAIR_IDS[params.pair];
      if (!pairId) {
        throw new Error(`Invalid trading pair: ${params.pair}`);
      }

      // Check balance
      const balance = await getCollateralBalance();
      if (parseFloat(balance) < parseFloat(params.margin)) {
        throw new Error(`Insufficient tUSD balance. Have: ${balance}, Need: ${params.margin}`);
      }

      // Ensure approval
      const approved = await ensureApproval(web3, account, params.margin);
      if (!approved) {
        return null;
      }

      const contract = getTradingContract(web3);
      const marginWei = web3.utils.toWei(params.margin, 'mwei');
      const isLong = params.direction === 'buy';

      toast({
        title: 'Opening Position',
        description: 'Please confirm the transaction in MetaMask',
      });

      const tx = await contract.methods
        .openPosition(pairId, marginWei, params.leverage, isLong)
        .send({ from: account });

      toast({
        title: 'Position Opened',
        description: `${isLong ? 'Long' : 'Short'} ${params.pair} with ${params.leverage}x leverage`,
      });

      return tx.transactionHash as string;
    } catch (error: any) {
      console.error('Error opening position:', error);
      toast({
        title: 'Failed to Open Position',
        description: error.message || 'Transaction failed',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Close a position
  const closePosition = async (positionId: number): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { web3, account } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      toast({
        title: 'Closing Position',
        description: 'Please confirm the transaction in MetaMask',
      });

      const tx = await contract.methods
        .closePosition(positionId)
        .send({ from: account });

      toast({
        title: 'Position Closed',
        description: `Position #${positionId} closed successfully`,
      });

      return tx.transactionHash as string;
    } catch (error: any) {
      console.error('Error closing position:', error);
      toast({
        title: 'Failed to Close Position',
        description: error.message || 'Transaction failed',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Liquidate a position (anyone can call)
  const liquidatePosition = async (positionId: number): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { web3, account } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      toast({
        title: 'Liquidating Position',
        description: 'Please confirm the transaction in MetaMask',
      });

      const tx = await contract.methods
        .liquidate(positionId)
        .send({ from: account });

      toast({
        title: 'Position Liquidated',
        description: `Position #${positionId} liquidated`,
      });

      return tx.transactionHash as string;
    } catch (error: any) {
      console.error('Error liquidating position:', error);
      toast({
        title: 'Liquidation Failed',
        description: error.message || 'Position may not be liquidatable',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Get user's open positions
  const getUserOpenPositions = async (): Promise<PositionV2[]> => {
    try {
      const { web3, account } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      const positionIds: any[] = await contract.methods
        .getUserOpenPositions(account)
        .call();

      if (!positionIds || positionIds.length === 0) {
        return [];
      }

      const positions = await Promise.all(
        positionIds.map(async (id) => {
          const position: any = await contract.methods.getPosition(id).call();
          const pnl: any = await contract.methods.getCurrentPnL(id).call();

          // Find pair name from pairId
          const pairName = Object.entries(PAIR_IDS).find(
            ([, hash]) => hash.toLowerCase() === position.pairId.toLowerCase()
          )?.[0] || 'Unknown';

          return {
            id: Number(id),
            trader: position.trader,
            pairId: position.pairId,
            pair: pairName,
            margin: web3.utils.fromWei(position.margin.toString(), 'mwei'),
            leverage: Number(position.leverage),
            entryPrice: web3.utils.fromWei(position.entryPrice.toString(), 'ether'),
            liquidationPrice: web3.utils.fromWei(position.liquidationPrice.toString(), 'ether'),
            isLong: position.isLong,
            isOpen: position.isOpen,
            openedAt: Number(position.openedAt),
            closedAt: Number(position.closedAt),
            currentPnL: web3.utils.fromWei(pnl.toString(), 'mwei'),
          };
        })
      );

      return positions;
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [];
    }
  };

  // Get all user positions (including closed)
  const getAllUserPositions = async (): Promise<PositionV2[]> => {
    try {
      const { web3, account } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      const positionIds: any[] = await contract.methods
        .getUserPositions(account)
        .call();

      if (!positionIds || positionIds.length === 0) {
        return [];
      }

      const positions = await Promise.all(
        positionIds.map(async (id) => {
          const position: any = await contract.methods.getPosition(id).call();
          
          let currentPnL = '0';
          if (position.isOpen) {
            const pnl: any = await contract.methods.getCurrentPnL(id).call();
            currentPnL = web3.utils.fromWei(pnl.toString(), 'mwei');
          }

          const pairName = Object.entries(PAIR_IDS).find(
            ([, hash]) => hash.toLowerCase() === position.pairId.toLowerCase()
          )?.[0] || 'Unknown';

          return {
            id: Number(id),
            trader: position.trader,
            pairId: position.pairId,
            pair: pairName,
            margin: web3.utils.fromWei(position.margin.toString(), 'mwei'),
            leverage: Number(position.leverage),
            entryPrice: web3.utils.fromWei(position.entryPrice.toString(), 'ether'),
            liquidationPrice: web3.utils.fromWei(position.liquidationPrice.toString(), 'ether'),
            isLong: position.isLong,
            isOpen: position.isOpen,
            openedAt: Number(position.openedAt),
            closedAt: Number(position.closedAt),
            currentPnL,
          };
        })
      );

      return positions;
    } catch (error) {
      console.error('Error fetching all positions:', error);
      return [];
    }
  };

  // Get single position by ID
  const getPosition = async (positionId: number): Promise<PositionV2 | null> => {
    try {
      const { web3 } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      const position: any = await contract.methods.getPosition(positionId).call();
      
      let currentPnL = '0';
      if (position.isOpen) {
        const pnl: any = await contract.methods.getCurrentPnL(positionId).call();
        currentPnL = web3.utils.fromWei(pnl.toString(), 'mwei');
      }

      const pairName = Object.entries(PAIR_IDS).find(
        ([, hash]) => hash.toLowerCase() === position.pairId.toLowerCase()
      )?.[0] || 'Unknown';

      return {
        id: positionId,
        trader: position.trader,
        pairId: position.pairId,
        pair: pairName,
        margin: web3.utils.fromWei(position.margin.toString(), 'mwei'),
        leverage: Number(position.leverage),
        entryPrice: web3.utils.fromWei(position.entryPrice.toString(), 'ether'),
        liquidationPrice: web3.utils.fromWei(position.liquidationPrice.toString(), 'ether'),
        isLong: position.isLong,
        isOpen: position.isOpen,
        openedAt: Number(position.openedAt),
        closedAt: Number(position.closedAt),
        currentPnL,
      };
    } catch (error) {
      console.error('Error fetching position:', error);
      return null;
    }
  };

  return {
    isLoading,
    approvalPending,
    openPosition,
    closePosition,
    liquidatePosition,
    getUserOpenPositions,
    getAllUserPositions,
    getPosition,
    getCollateralBalance,
    getPlatformConfig,
    computePairId,
  };
};

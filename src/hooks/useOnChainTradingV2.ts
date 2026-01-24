import { useState, useCallback } from 'react';
import Web3 from 'web3';
import { useToast } from '@/hooks/use-toast';
import { CONTRACT_ADDRESSES, FEE_CONFIG } from '@/config/contracts';

// V2 Contract addresses from config
export const TRADING_PLATFORM_V2_ADDRESS = CONTRACT_ADDRESSES.amoy.TradingPlatformV2;
export const PRICE_ORACLE_V2_ADDRESS = CONTRACT_ADDRESSES.amoy.PriceOracleV2;
export const TUSD_ADDRESS = CONTRACT_ADDRESSES.amoy.TokenizedCurrency;

// TradingPlatformV2 ABI (updated with fee functions)
const TRADING_PLATFORM_V2_ABI = [
  {
    inputs: [
      { name: 'pairId', type: 'bytes32' },
      { name: 'isLong', type: 'bool' },
      { name: 'margin', type: 'uint256' },
      { name: 'leverage', type: 'uint256' },
      { name: 'stopLoss', type: 'uint256' },
      { name: 'takeProfit', type: 'uint256' }
    ],
    name: 'openPosition',
    outputs: [{ name: 'id', type: 'uint256' }],
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
          { name: 'id', type: 'uint256' },
          { name: 'trader', type: 'address' },
          { name: 'pairId', type: 'bytes32' },
          { name: 'isLong', type: 'bool' },
          { name: 'margin', type: 'uint256' },
          { name: 'leverage', type: 'uint256' },
          { name: 'entryPrice', type: 'uint256' },
          { name: 'liquidationPrice', type: 'uint256' },
          { name: 'stopLoss', type: 'uint256' },
          { name: 'takeProfit', type: 'uint256' },
          { name: 'isOpen', type: 'bool' },
          { name: 'openedAt', type: 'uint256' }
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
  },
  // Fee functions
  {
    inputs: [],
    name: 'treasury',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'openFeeBps',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'closeFeeBps',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'liquidatorRewardBps',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'margin', type: 'uint256' }],
    name: 'calculateOpenFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'profit', type: 'uint256' }],
    name: 'calculateCloseFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getFeeConfig',
    outputs: [
      { name: '_treasury', type: 'address' },
      { name: '_openFeeBps', type: 'uint256' },
      { name: '_closeFeeBps', type: 'uint256' },
      { name: '_liquidatorRewardBps', type: 'uint256' }
    ],
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
  treasury?: string;
  openFeeBps?: number;
  closeFeeBps?: number;
  liquidatorRewardBps?: number;
}

export interface FeeInfo {
  treasury: string;
  openFeeBps: number;
  closeFeeBps: number;
  liquidatorRewardBps: number;
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

  // Get platform configuration including fees
  const getPlatformConfig = async (): Promise<PlatformConfig | null> => {
    try {
      const { web3 } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      const [maxLeverage, maintenanceMarginBps, maxProfitBps, feeConfig] = await Promise.all([
        contract.methods.maxLeverage().call(),
        contract.methods.maintenanceMarginBps().call(),
        contract.methods.maxProfitBps().call(),
        contract.methods.getFeeConfig().call().catch(() => null),
      ]);

      const config: PlatformConfig = {
        maxLeverage: Number(maxLeverage),
        maintenanceMarginBps: Number(maintenanceMarginBps),
        maxProfitBps: Number(maxProfitBps),
      };

      // Add fee info if available (new contract)
      if (feeConfig) {
        config.treasury = (feeConfig as any)._treasury;
        config.openFeeBps = Number((feeConfig as any)._openFeeBps);
        config.closeFeeBps = Number((feeConfig as any)._closeFeeBps);
        config.liquidatorRewardBps = Number((feeConfig as any)._liquidatorRewardBps);
      }

      return config;
    } catch (error) {
      console.error('Error fetching platform config:', error);
      return null;
    }
  };

  // Get fee configuration
  const getFeeConfig = async (): Promise<FeeInfo | null> => {
    try {
      const { web3 } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      const result: any = await contract.methods.getFeeConfig().call();
      
      return {
        treasury: result._treasury,
        openFeeBps: Number(result._openFeeBps),
        closeFeeBps: Number(result._closeFeeBps),
        liquidatorRewardBps: Number(result._liquidatorRewardBps),
      };
    } catch (error) {
      console.error('Error fetching fee config:', error);
      // Return default config from FEE_CONFIG
      return {
        treasury: '',
        openFeeBps: FEE_CONFIG.openFeeBps,
        closeFeeBps: FEE_CONFIG.closeFeeBps,
        liquidatorRewardBps: FEE_CONFIG.liquidatorRewardBps,
      };
    }
  };

  // Calculate open fee (local calculation for UI preview)
  const calculateOpenFee = (margin: number): number => {
    return (margin * FEE_CONFIG.openFeeBps) / 10000;
  };

  // Calculate close fee (local calculation for UI preview)
  const calculateCloseFee = (profit: number): number => {
    if (profit <= 0) return 0;
    return (profit * FEE_CONFIG.closeFeeBps) / 10000;
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

      // Calculate expected fee for display
      const fee = calculateOpenFee(parseFloat(params.margin));
      const netMargin = parseFloat(params.margin) - fee;

      toast({
        title: 'Opening Position',
        description: `Fee: ${fee.toFixed(2)} tUSD (0.08%) | Net margin: ${netMargin.toFixed(2)} tUSD`,
      });

      const tx = await contract.methods
        .openPosition(pairId, isLong, marginWei, params.leverage, 0, 0)
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
        description: 'Please confirm the transaction in MetaMask. A 0.08% fee applies to profits.',
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

  // Liquidate a position (anyone can call - earns 30% reward)
  const liquidatePosition = async (positionId: number): Promise<string | null> => {
    setIsLoading(true);
    try {
      const { web3, account } = await getWeb3AndAccount();
      const contract = getTradingContract(web3);

      toast({
        title: 'Liquidating Position',
        description: 'Please confirm. You will receive 30% of the liquidated margin as reward.',
      });

      const tx = await contract.methods
        .liquidate(positionId)
        .send({ from: account });

      toast({
        title: 'Position Liquidated',
        description: `Position #${positionId} liquidated. 30% reward earned!`,
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
            closedAt: 0,
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
            closedAt: 0,
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
        closedAt: 0,
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
    getFeeConfig,
    calculateOpenFee,
    calculateCloseFee,
    computePairId,
  };
};

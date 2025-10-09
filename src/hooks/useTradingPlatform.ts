import { useState, useCallback } from 'react';
import Web3 from 'web3';
import { TRADING_PLATFORM_ADDRESS } from './useTokenContracts';
import { useToast } from '@/hooks/use-toast';

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

interface OpenPositionParams {
  pair: string;
  direction: 'buy' | 'sell';
  collateral: string;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface Position {
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

export const useTradingPlatform = (web3: Web3 | null, account: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getTradingContract = useCallback(() => {
    if (!web3) return null;
    if (TRADING_PLATFORM_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    return new web3.eth.Contract(TRADING_PLATFORM_ABI as any, TRADING_PLATFORM_ADDRESS);
  }, [web3]);

  const openPosition = async (params: OpenPositionParams): Promise<string | null> => {
    const contract = getTradingContract();
    if (!contract || !account) {
      toast({
        title: "Error",
        description: "Trading platform not available",
        variant: "destructive",
      });
      return null;
    }

    setIsLoading(true);
    try {
      const collateralWei = web3!.utils.toWei(params.collateral, 'mwei'); // Assuming 6 decimals
      const stopLossWei = params.stopLoss ? web3!.utils.toWei(params.stopLoss.toString(), 'ether') : 0;
      const takeProfitWei = params.takeProfit ? web3!.utils.toWei(params.takeProfit.toString(), 'ether') : 0;

      const tx = await contract.methods
        .openPosition(
          params.pair,
          params.direction === 'buy',
          collateralWei,
          params.leverage,
          stopLossWei,
          takeProfitWei
        )
        .send({ from: account });

      toast({
        title: "Position Opened",
        description: `Successfully opened ${params.direction} position for ${params.pair}`,
      });

      return tx.transactionHash;
    } catch (error: any) {
      console.error('Error opening position:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to open position",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const closePosition = async (positionId: number): Promise<string | null> => {
    const contract = getTradingContract();
    if (!contract || !account) return null;

    setIsLoading(true);
    try {
      const tx = await contract.methods
        .closePosition(positionId)
        .send({ from: account });

      toast({
        title: "Position Closed",
        description: `Successfully closed position #${positionId}`,
      });

      return tx.transactionHash;
    } catch (error: any) {
      console.error('Error closing position:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to close position",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getUserPositions = async (): Promise<Position[]> => {
    const contract = getTradingContract();
    if (!contract || !account) return [];

    try {
      const positionIds: any = await contract.methods.getUserPositions(account).call();
      
      if (!positionIds || positionIds.length === 0) {
        return [];
      }

      const positions = await Promise.all(
        Array.from(positionIds).map(async (id: any) => {
          const position: any = await contract.methods.positions(id).call();
          const pnl: any = await contract.methods.getCurrentPnL(id).call();
          
          return {
            id: Number(id),
            trader: position.trader,
            pair: position.pair,
            isLong: position.isLong,
            collateral: web3!.utils.fromWei(position.collateral.toString(), 'mwei'),
            leverage: Number(position.leverage),
            size: web3!.utils.fromWei(position.size.toString(), 'mwei'),
            entryPrice: web3!.utils.fromWei(position.entryPrice.toString(), 'ether'),
            stopLoss: web3!.utils.fromWei(position.stopLoss.toString(), 'ether'),
            takeProfit: web3!.utils.fromWei(position.takeProfit.toString(), 'ether'),
            openedAt: Number(position.openedAt),
            isOpen: position.isOpen,
            currentPnL: web3!.utils.fromWei(pnl.toString(), 'mwei'),
          };
        })
      );

      return positions;
    } catch (error) {
      console.error('Error fetching user positions:', error);
      return [];
    }
  };

  return {
    isLoading,
    openPosition,
    closePosition,
    getUserPositions,
  };
};

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, X } from "lucide-react";
import { useOnChainTradingV2, PositionV2, PAIR_IDS } from '@/hooks/useOnChainTradingV2';
import { useNetworkEnforcement } from '@/hooks/useNetworkEnforcement';

interface V2PositionsPanelProps {
  onRefreshBalance?: () => void;
}

const V2PositionsPanel: React.FC<V2PositionsPanelProps> = ({ onRefreshBalance }) => {
  const [positions, setPositions] = useState<PositionV2[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { getUserOpenPositions, closePosition, isLoading: actionLoading } = useOnChainTradingV2();
  const { isCorrectNetwork } = useNetworkEnforcement();

  const fetchPositions = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const userPositions = await getUserOpenPositions();
      setPositions(userPositions);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [getUserOpenPositions]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleClosePosition = async (positionId: number) => {
    setIsLoading(true);
    try {
      const txHash = await closePosition(positionId);
      if (txHash) {
        await fetchPositions();
        onRefreshBalance?.();
      }
    } catch (error) {
      console.error('Error closing position:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return '-';
    return num.toFixed(5);
  };

  const formatPnL = (pnl: string | undefined) => {
    if (!pnl) return '-';
    const num = parseFloat(pnl);
    const formatted = num.toFixed(2);
    return num >= 0 ? `+$${formatted}` : `-$${Math.abs(num).toFixed(2)}`;
  };

  const getPnLColor = (pnl: string | undefined) => {
    if (!pnl) return 'text-muted-foreground';
    const num = parseFloat(pnl);
    if (num > 0) return 'text-green-500';
    if (num < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const isNearLiquidation = (position: PositionV2) => {
    // Check if current price is within 10% of liquidation price
    const currentPnL = parseFloat(position.currentPnL || '0');
    const margin = parseFloat(position.margin);
    const lossPercent = Math.abs(currentPnL) / margin * 100;
    return currentPnL < 0 && lossPercent > 80;
  };

  if (positions.length === 0 && !isRefreshing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Open Positions (V2)</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchPositions} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No open positions
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Open Positions (V2)</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchPositions} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isRefreshing && positions.length === 0 ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          positions.map((position) => (
            <div
              key={position.id}
              className={`p-3 rounded-lg border ${
                isNearLiquidation(position) ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={position.isLong ? 'default' : 'destructive'} className="text-xs">
                    {position.isLong ? (
                      <><TrendingUp className="h-3 w-3 mr-1" /> Long</>
                    ) : (
                      <><TrendingDown className="h-3 w-3 mr-1" /> Short</>
                    )}
                  </Badge>
                  <span className="font-semibold">{position.pair}</span>
                  <Badge variant="outline" className="text-xs">{position.leverage}x</Badge>
                </div>
                {isNearLiquidation(position) && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Near Liquidation
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Entry:</span>
                  <span className="ml-1 font-mono">{formatPrice(position.entryPrice)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Liq:</span>
                  <span className="ml-1 font-mono text-red-500">{formatPrice(position.liquidationPrice)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Margin:</span>
                  <span className="ml-1 font-mono">${position.margin}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">PnL:</span>
                  <span className={`ml-1 font-mono font-semibold ${getPnLColor(position.currentPnL)}`}>
                    {formatPnL(position.currentPnL)}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleClosePosition(position.id)}
                disabled={isLoading || actionLoading || !isCorrectNetwork}
              >
                <X className="h-4 w-4 mr-1" />
                Close Position
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default V2PositionsPanel;

import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICE_ORACLE_V2_ADDRESS, PAIR_IDS, computePairId } from '@/hooks/useOnChainTradingV2';

// Public RPC endpoints with fallbacks (avoid MetaMask provider overload)
const RPC_ENDPOINTS = [
  'https://rpc-amoy.polygon.technology/',
  'https://polygon-amoy.drpc.org/',
  'https://polygon-amoy-bor-rpc.publicnode.com'
];

// PriceOracleV2 ABI - minimal for getPrice
const PRICE_ORACLE_V2_ABI = [
  {
    inputs: [{ name: 'pairId', type: 'bytes32' }],
    name: 'getPrice',
    outputs: [
      { name: 'price', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pairId', type: 'bytes32' }],
    name: 'hasFeed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  }
];

interface OracleFeedStatus {
  pair: string;
  available: boolean;
  lastUpdated: number | null;
  price: string | null;
  isStale: boolean;
}

type OverallStatus = 'healthy' | 'degraded' | 'unavailable' | 'loading';

// Staleness thresholds (in seconds)
const STALE_THRESHOLD = 5 * 60; // 5 minutes - yellow warning
const CRITICAL_THRESHOLD = 30 * 60; // 30 minutes - red warning

const OracleStatus = () => {
  const [feedStatuses, setFeedStatuses] = useState<OracleFeedStatus[]>([]);
  const [overallStatus, setOverallStatus] = useState<OverallStatus>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchOracleStatus = useCallback(async (rpcIndex: number = 0) => {
    setIsRefreshing(true);
    const maxRetries = RPC_ENDPOINTS.length;
    
    try {
      // Use public RPC instead of MetaMask provider to reduce load
      const endpoint = RPC_ENDPOINTS[rpcIndex % RPC_ENDPOINTS.length];
      const web3 = new Web3(endpoint);
      const contract = new web3.eth.Contract(PRICE_ORACLE_V2_ABI as any, PRICE_ORACLE_V2_ADDRESS);
      
      // Check if contract is reachable
      try {
        await web3.eth.getCode(PRICE_ORACLE_V2_ADDRESS);
        setIsConnected(true);
      } catch (error: any) {
        // Retry with fallback RPC
        if (rpcIndex < maxRetries - 1) {
          console.log(`OracleStatus: Retrying with fallback RPC (attempt ${rpcIndex + 2}/${maxRetries})...`);
          return fetchOracleStatus(rpcIndex + 1);
        }
        setOverallStatus('unavailable');
        setIsConnected(false);
        return;
      }

      const pairs = Object.keys(PAIR_IDS);
      const currentTime = Math.floor(Date.now() / 1000);
      
      const statuses: OracleFeedStatus[] = await Promise.all(
        pairs.map(async (pair) => {
          try {
            const pairId = computePairId(pair);
            if (!pairId) {
              return {
                pair,
                available: false,
                lastUpdated: null,
                price: null,
                isStale: true
              };
            }

            // Check if feed exists
            const hasFeed = await contract.methods.hasFeed(pairId).call() as boolean;
            if (!hasFeed) {
              return {
                pair,
                available: false,
                lastUpdated: null,
                price: null,
                isStale: true
              };
            }

            // Get price and timestamp
            const result = await contract.methods.getPrice(pairId).call() as { price: string; updatedAt: string };
            const updatedAt = Number(result.updatedAt);
            const price = web3.utils.fromWei(result.price, 'ether');
            const staleness = currentTime - updatedAt;

            return {
              pair,
              available: true,
              lastUpdated: updatedAt,
              price,
              isStale: staleness > STALE_THRESHOLD
            };
          } catch (error) {
            console.error(`Error fetching oracle status for ${pair}:`, error);
            return {
              pair,
              available: false,
              lastUpdated: null,
              price: null,
              isStale: true
            };
          }
        })
      );

      setFeedStatuses(statuses);
      setLastRefresh(new Date());

      // Determine overall status
      const availableFeeds = statuses.filter(s => s.available);
      const staleFeeds = statuses.filter(s => s.isStale);
      
      if (availableFeeds.length === 0) {
        setOverallStatus('unavailable');
      } else if (staleFeeds.length > 0) {
        setOverallStatus('degraded');
      } else {
        setOverallStatus('healthy');
      }
    } catch (error) {
      console.error('Error fetching oracle status:', error);
      setOverallStatus('unavailable');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOracleStatus();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchOracleStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchOracleStatus]);

  const getStatusIcon = () => {
    switch (overallStatus) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'loading':
        return <Activity className="h-4 w-4 text-muted-foreground animate-pulse" />;
    }
  };

  const getStatusText = () => {
    switch (overallStatus) {
      case 'healthy':
        return 'Oracle Active';
      case 'degraded':
        return 'Feeds Stale';
      case 'unavailable':
        return 'Oracle Offline';
      case 'loading':
        return 'Connecting...';
    }
  };

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'healthy':
        return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      case 'degraded':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
      case 'unavailable':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'loading':
        return 'bg-muted border-border';
    }
  };

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    const now = Date.now();
    const diffSeconds = Math.floor((now - date.getTime()) / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  };

  const availableCount = feedStatuses.filter(s => s.available).length;
  const totalCount = feedStatuses.length;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusColor()} cursor-pointer`}>
            <Zap className="h-4 w-4 text-primary" />
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
            {overallStatus !== 'loading' && (
              <Badge variant="outline" className="text-xs ml-1">
                {availableCount}/{totalCount}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                fetchOracleStatus();
              }}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-72 p-0">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Price Oracle Status</span>
              {lastRefresh && (
                <span className="text-xs text-muted-foreground">
                  Updated: {formatTimestamp(Math.floor(lastRefresh.getTime() / 1000))}
                </span>
              )}
            </div>
            
            {!isConnected && (
              <div className="text-sm text-destructive mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Unable to reach oracle - network unavailable
              </div>
            )}
            
            <div className="space-y-2">
              {feedStatuses.map((feed) => (
                <div 
                  key={feed.pair} 
                  className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0"
                >
                  <span className="font-mono">{feed.pair}</span>
                  <div className="flex items-center gap-2">
                    {feed.available ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(feed.lastUpdated)}
                        </span>
                        {feed.isStale ? (
                          <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        ) : (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground">Simulated</span>
                        <XCircle className="h-3 w-3 text-red-400" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" /> Fresh (&lt;5m)
                <AlertTriangle className="h-3 w-3 text-yellow-500 ml-2" /> Stale (&gt;5m)
                <XCircle className="h-3 w-3 text-red-400 ml-2" /> Unavailable
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default OracleStatus;

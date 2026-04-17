import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { SignalObject } from '@/types/signal';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedSignalCardProps {
  signal: SignalObject;
  onApprove: (signal: SignalObject) => void;
}

export const EnhancedSignalCard: React.FC<EnhancedSignalCardProps> = ({ signal, onApprove }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  const getDirectionIcon = (direction: string) => {
    return direction === 'LONG' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getDirectionColor = (direction: string) => {
    return direction === 'LONG' ? 'text-green-600' : 'text-red-600';
  };

  const getSignalStatusBadge = (signal: SignalObject) => {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = signal.expires_at && signal.expires_at < now;
    
    if (isExpired) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
          <Clock className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }

    if (signal.trade_id) {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-600">
          <RefreshCw className="h-3 w-3 mr-1" />
          Executed
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="bg-green-100 text-green-600">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </Badge>
    );
  };

  const getTradeStatusBadge = (signal: SignalObject) => {
    if (!signal.trade_id) return null;

    switch (signal.trade_status) {
      case 'OPEN':
        return (
          <Badge variant="outline" className="border-blue-200 text-blue-600">
            <Clock className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
      case 'CLOSED':
        return (
          <Badge variant="outline" className="border-green-200 text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Closed
          </Badge>
        );
      case 'LIQUIDATED':
        return (
          <Badge variant="outline" className="border-red-200 text-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            Liquidated
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {signal.trade_status}
          </Badge>
        );
    }
  };

  const getPNLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600';
    if (pnl < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const handleExecuteTrade = async () => {
    if (signal.trade_id) {
      toast({
        title: "Already Executed",
        description: "This signal has already been executed.",
        variant: "default",
      });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (signal.expires_at && signal.expires_at < now) {
      toast({
        title: "Signal Expired",
        description: "This signal has expired and cannot be executed.",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke('execute-trade', {
        body: { signal_id: signal.id, account_mode: 'demo' },
      });

      if (error) throw new Error(error.message || 'Execution failed');
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Trade Executed",
        description: `${signal.direction} ${signal.pair} @ ${data.entry_price} — Trade ID: ${data.trade_id?.slice(0, 8)}`,
        variant: "default",
      });
      onApprove(signal);
    } catch (error: any) {
      console.error('Trade execution failed:', error);
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute trade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(price);
  };

  const formatPNL = (pnl: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(pnl);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold">{signal.pair}</CardTitle>
              <span className={`flex items-center gap-1 ${getDirectionColor(signal.direction)}`}>
                {getDirectionIcon(signal.direction)}
                <span className="font-medium">{signal.direction}</span>
              </span>
            </div>
            <CardDescription>
              {signal.market} • {signal.timeframe} • {signal.strategy}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {getSignalStatusBadge(signal)}
            {getTradeStatusBadge(signal)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Confidence and Risk */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Confidence</span>
              <span className="font-medium">{Math.round(signal.confidence * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${signal.confidence * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Risk Level</span>
              <span className="font-medium capitalize">{signal.risk?.risk_level || 'MODERATE'}</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={`w-2 h-6 rounded ${
                    (signal.risk?.risk_level === 'HIGH' && level <= 3) ||
                    (signal.risk?.risk_level === 'MODERATE' && level <= 2) ||
                    (signal.risk?.risk_level === 'LOW' && level <= 1)
                      ? 'bg-orange-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Price Levels */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Entry Zone</span>
            <div className="font-medium">
              {Array.isArray(signal.entry_zone) 
                ? `${formatPrice(signal.entry_zone[0])} - ${formatPrice(signal.entry_zone[1])}`
                : formatPrice(signal.entry_zone)
              }
            </div>
          </div>
          <div>
            <span className="text-gray-600">Stop Loss</span>
            <div className="font-medium">{formatPrice(signal.stop_loss)}</div>
          </div>
          <div>
            <span className="text-gray-600">Take Profit</span>
            <div className="font-medium">
              {Array.isArray(signal.take_profit) 
                ? signal.take_profit.map((tp, index) => (
                    <div key={index} className="text-sm">
                      TP {index + 1}: {formatPrice(tp)}
                    </div>
                  ))
                : formatPrice(signal.take_profit)
              }
            </div>
          </div>
        </div>

        {/* Trade Context */}
        {signal.trade_id && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Entry Price</span>
                <div className="font-medium">
                  {signal.trade_entry_price ? formatPrice(signal.trade_entry_price) : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Exit Price</span>
                <div className="font-medium">
                  {signal.trade_exit_price ? formatPrice(signal.trade_exit_price) : 'N/A'}
                </div>
              </div>
              {signal.trade_pnl !== undefined && (
                <div className="col-span-2">
                  <span className="text-gray-600">P&L</span>
                  <div className={`font-medium ${getPNLColor(signal.trade_pnl)}`}>
                    {formatPNL(signal.trade_pnl)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chart toggle */}
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setShowChart((s) => !s)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LineChartIcon className="h-4 w-4" />
            {showChart ? 'Hide chart' : 'Show chart with levels'}
            {showChart ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showChart && (
            <div className="mt-3">
              <SignalChart signal={signal} height={240} />
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500" /> Entry zone</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" /> Stop loss</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500" /> Take profit</span>
              </div>
            </div>
          )}
        </div>

        {/* Explanation */}
        {signal.explanation && signal.explanation.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm text-gray-600 mb-2">Analysis</div>
            <div className="text-sm space-y-1">
              {signal.explanation.slice(0, 3).map((line, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{line}</span>
                </div>
              ))}
              {signal.explanation.length > 3 && (
                <div className="text-xs text-gray-500 mt-1">
                  +{signal.explanation.length - 3} more points
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <div className="flex justify-between items-center w-full">
          <div className="text-xs text-gray-500">
            Created: {new Date(signal.created_at).toLocaleString()}
            {signal.expires_at && (
              <>
                <br />
                Expires: {new Date(signal.expires_at * 1000).toLocaleString()}
              </>
            )}
          </div>
          
          <Button
            onClick={handleExecuteTrade}
            disabled={isExecuting || !!signal.trade_id || (signal.expires_at && signal.expires_at < Math.floor(Date.now() / 1000))}
            className={`${
              signal.direction === 'LONG' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } text-white`}
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : signal.trade_id ? (
              'Executed'
            ) : (
              'Execute Trade'
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
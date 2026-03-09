import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

interface EquityCurveChartProps {
  history: Array<{
    timestamp: string;
    equity: number;
    balance: number;
  }>;
  startingBalance: number;
  peakEquity: number;
  maxDrawdownPercent: number;
  onTimeRangeChange: (range: '1d' | '7d' | '30d' | 'all') => void;
  currentTimeRange: '1d' | '7d' | '30d' | 'all';
}

export function EquityCurveChart({
  history,
  startingBalance,
  peakEquity,
  maxDrawdownPercent,
  onTimeRangeChange,
  currentTimeRange,
}: EquityCurveChartProps) {
  const chartData = history.map(h => ({
    time: format(new Date(h.timestamp), 'MMM dd HH:mm'),
    equity: Number(h.equity.toFixed(2)),
    balance: Number(h.balance.toFixed(2)),
  }));

  const timeRanges: Array<{ value: '1d' | '7d' | '30d' | 'all'; label: string }> = [
    { value: '1d', label: '1D' },
    { value: '7d', label: '1W' },
    { value: '30d', label: '1M' },
    { value: 'all', label: 'All' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Equity Curve</CardTitle>
            <CardDescription>
              Track your account equity over time
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {timeRanges.map(({ value, label }) => (
              <Button
                key={value}
                variant={currentTimeRange === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTimeRangeChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No portfolio history available yet
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <ReferenceLine
                  y={startingBalance}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                  label={{
                    value: 'Starting Balance',
                    position: 'insideTopRight',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 12,
                  }}
                />
                {peakEquity > startingBalance && (
                  <ReferenceLine
                    y={peakEquity}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="3 3"
                    label={{
                      value: 'Peak',
                      position: 'insideTopRight',
                      fill: 'hsl(var(--primary))',
                      fontSize: 12,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Equity"
                />
              </LineChart>
            </ResponsiveContainer>
            {maxDrawdownPercent > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">Max Drawdown:</span>
                <span className="font-semibold text-destructive">
                  -{maxDrawdownPercent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

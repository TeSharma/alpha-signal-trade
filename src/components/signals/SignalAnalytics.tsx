import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSignalPerformance } from "@/hooks/useSignalPerformance";
import { TrendingUp, Trophy, Target, BarChart3, Loader2 } from "lucide-react";

export function SignalAnalytics() {
  const { stats, isLoading } = useSignalPerformance();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading performance data...
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No performance data yet. Generate and let signals run to see results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{stats.open} open</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${stats.winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">{stats.wins}W / {stats.losses}L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Avg PnL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${stats.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">per resolved signal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3 w-3" /> Best Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold truncate">{stats.bestStrategy || '—'}</p>
            <p className="text-xs text-muted-foreground">highest win rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy Breakdown */}
      {stats.strategyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Strategy Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.strategyBreakdown.map((s) => (
                <div key={s.strategy} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{s.strategy}</p>
                    <p className="text-xs text-muted-foreground">{s.total} signals</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.winRate >= 50 ? 'default' : 'secondary'} className={s.winRate >= 50 ? 'bg-green-600' : ''}>
                      {s.winRate.toFixed(0)}% WR
                    </Badge>
                    <span className={`text-sm font-mono ${s.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {s.avgPnl >= 0 ? '+' : ''}{s.avgPnl.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

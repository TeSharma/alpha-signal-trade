import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, AlertTriangle, Award, BarChart3 } from 'lucide-react';

interface PortfolioStatsProps {
  totalReturn: number;
  totalReturnPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  winRate?: number;
}

export function PortfolioStats({
  totalReturn,
  totalReturnPercent,
  profitFactor,
  maxDrawdownPercent,
  avgWin,
  avgLoss,
  largestWin,
  largestLoss,
  winRate,
}: PortfolioStatsProps) {
  const stats = [
    {
      title: 'Total Return',
      value: `$${totalReturn.toFixed(2)}`,
      subtitle: `${totalReturnPercent >= 0 ? '+' : ''}${totalReturnPercent.toFixed(2)}%`,
      icon: totalReturn >= 0 ? TrendingUp : TrendingDown,
      iconColor: totalReturn >= 0 ? 'text-green-500' : 'text-red-500',
    },
    {
      title: 'Profit Factor',
      value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
      subtitle: profitFactor >= 2 ? 'Excellent' : profitFactor >= 1.5 ? 'Good' : profitFactor >= 1 ? 'Break-even' : 'Needs Work',
      icon: Target,
      iconColor: profitFactor >= 1.5 ? 'text-green-500' : profitFactor >= 1 ? 'text-yellow-500' : 'text-red-500',
    },
    {
      title: 'Max Drawdown',
      value: `${maxDrawdownPercent.toFixed(2)}%`,
      subtitle: maxDrawdownPercent < 10 ? 'Low risk' : maxDrawdownPercent < 20 ? 'Moderate' : 'High risk',
      icon: AlertTriangle,
      iconColor: maxDrawdownPercent < 10 ? 'text-green-500' : maxDrawdownPercent < 20 ? 'text-yellow-500' : 'text-red-500',
    },
    {
      title: 'Avg Win / Loss',
      value: avgWin > 0 ? `$${avgWin.toFixed(2)}` : 'N/A',
      subtitle: avgLoss > 0 ? `$${avgLoss.toFixed(2)} loss` : 'No losses',
      icon: BarChart3,
      iconColor: 'text-primary',
    },
    {
      title: 'Largest Win',
      value: largestWin > 0 ? `$${largestWin.toFixed(2)}` : 'N/A',
      subtitle: 'Best trade',
      icon: Award,
      iconColor: 'text-green-500',
    },
    {
      title: 'Largest Loss',
      value: largestLoss > 0 ? `$${largestLoss.toFixed(2)}` : 'N/A',
      subtitle: 'Worst trade',
      icon: TrendingDown,
      iconColor: 'text-red-500',
    },
  ];

  if (winRate !== undefined) {
    stats.unshift({
      title: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      subtitle: winRate >= 60 ? 'Excellent' : winRate >= 50 ? 'Good' : 'Needs Work',
      icon: Target,
      iconColor: winRate >= 60 ? 'text-green-500' : winRate >= 50 ? 'text-yellow-500' : 'text-red-500',
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
        <CardDescription>
          Key trading statistics and risk metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className={`p-2 rounded-full bg-muted ${stat.iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-xl font-bold truncate">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

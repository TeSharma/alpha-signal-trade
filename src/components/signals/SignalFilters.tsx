import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { useSignalList } from '@/hooks/useSignalList';
import { 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign 
} from 'lucide-react';

export const SignalFilters: React.FC = () => {
  const { filters, setFilters, sort, setSort } = useSignalList();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({});
    setSort({ field: 'confidence', direction: 'desc' });
  };

  const availableMarkets = ['CRYPTO', 'FOREX', 'STOCKS'];
  const availableDirections = ['LONG', 'SHORT'];
  const availableStatuses = ['active', 'executed', 'closed', 'expired'];
  const availableTradeStatuses = ['OPEN', 'CLOSED', 'LIQUIDATED'];
  const availableResults = ['WIN', 'LOSS'];
  const availableStrategies = ['TREND_FOLLOWING', 'MEAN_REVERSION', 'BREAKOUT'];
  const availableTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const availablePairs = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY'];

  return (
    <div className="space-y-4">
      {/* Main Filter Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Market Filter */}
        <div className="flex items-center gap-2">
          <Label htmlFor="market-filter" className="text-sm font-medium">Market</Label>
          <Select
            value={filters.market?.[0] || ''}
            onValueChange={(value) => handleFilterChange('market', value ? [value] : undefined)}
          >
            <SelectTrigger id="market-filter" className="w-[140px]">
              <SelectValue placeholder="All Markets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              {availableMarkets.map(market => (
                <SelectItem key={market} value={market}>{market}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Direction Filter */}
          <Select
            value={filters.direction?.[0] || ''}
            onValueChange={(value) => handleFilterChange('direction', value ? [value] : undefined)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Direction</SelectItem>
              {availableDirections.map(direction => (
                <SelectItem key={direction} value={direction}>
                  <div className="flex items-center gap-1">
                    {direction === 'LONG' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {direction}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={filters.status?.[0] || ''}
            onValueChange={(value) => handleFilterChange('status', value ? [value] : undefined)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              {availableStatuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Confidence Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="confidence-filter" className="text-sm font-medium">Confidence</Label>
            <div className="w-[200px]">
              <Slider
                id="confidence-filter"
                min={0}
                max={100}
                step={5}
                value={[filters.confidenceMin || 0, filters.confidenceMax || 100]}
                onValueChange={([min, max]) => {
                  handleFilterChange('confidenceMin', min);
                  handleFilterChange('confidenceMax', max);
                }}
              />
              <div className="text-xs text-gray-500 mt-1">
                {filters.confidenceMin || 0}% - {filters.confidenceMax || 100}%
              </div>
            </div>
          </div>

          {/* My Trades Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="my-trades"
              checked={filters.myTrades || false}
              onCheckedChange={(checked) => handleFilterChange('myTrades', checked)}
            />
            <Label htmlFor="my-trades" className="text-sm font-medium">My Trades Only</Label>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-auto"
        >
          <Filter className="h-4 w-4 mr-2" />
          {isExpanded ? 'Hide' : 'Show'} Advanced Filters
          {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </Button>

        {/* Clear Filters */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Trade Status Filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Trade Status</Label>
              <div className="space-y-1">
                {availableTradeStatuses.map(status => (
                  <label key={status} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.tradeStatus?.includes(status) || false}
                      onCheckedChange={(checked) => {
                        const current = filters.tradeStatus || [];
                        const updated = checked 
                          ? [...current, status]
                          : current.filter(s => s !== status);
                        handleFilterChange('tradeStatus', updated.length > 0 ? updated : undefined);
                      }}
                    />
                    <span className="text-sm">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Result Filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Result</Label>
              <div className="space-y-1">
                {availableResults.map(result => (
                  <label key={result} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.result?.includes(result) || false}
                      onCheckedChange={(checked) => {
                        const current = filters.result || [];
                        const updated = checked 
                          ? [...current, result]
                          : current.filter(r => r !== result);
                        handleFilterChange('result', updated.length > 0 ? updated : undefined);
                      }}
                    />
                    <span className="text-sm">{result}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Strategy Filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Strategy</Label>
              <div className="space-y-1">
                {availableStrategies.map(strategy => (
                  <label key={strategy} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.strategy?.includes(strategy) || false}
                      onCheckedChange={(checked) => {
                        const current = filters.strategy || [];
                        const updated = checked 
                          ? [...current, strategy]
                          : current.filter(s => s !== strategy);
                        handleFilterChange('strategy', updated.length > 0 ? updated : undefined);
                      }}
                    />
                    <span className="text-sm">{strategy}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Timeframe Filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Timeframe</Label>
              <div className="space-y-1">
                {availableTimeframes.map(timeframe => (
                  <label key={timeframe} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.timeframe?.includes(timeframe) || false}
                      onCheckedChange={(checked) => {
                        const current = filters.timeframe || [];
                        const updated = checked 
                          ? [...current, timeframe]
                          : current.filter(t => t !== timeframe);
                        handleFilterChange('timeframe', updated.length > 0 ? updated : undefined);
                      }}
                    />
                    <span className="text-sm">{timeframe}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pair Filter */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Pair</Label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {availablePairs.map(pair => (
                  <label key={pair} className="flex items-center space-x-2">
                    <Checkbox
                      checked={filters.pair?.includes(pair) || false}
                      onCheckedChange={(checked) => {
                        const current = filters.pair || [];
                        const updated = checked 
                          ? [...current, pair]
                          : current.filter(p => p !== pair);
                        handleFilterChange('pair', updated.length > 0 ? updated : undefined);
                      }}
                    />
                    <span className="text-sm">{pair}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Model Version Filter */}
            <div>
              <Label htmlFor="model-version" className="text-sm font-medium mb-2 block">Model Version</Label>
              <Input
                id="model-version"
                placeholder="e.g., v1.2.3"
                value={filters.modelVersion?.[0] || ''}
                onChange={(e) => handleFilterChange('modelVersion', e.target.value ? [e.target.value] : undefined)}
              />
            </div>
          </div>

          {/* Sort Options */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-2 block">Sort By</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="sort-field" className="text-sm">Field</Label>
                <Select
                  value={sort.field}
                  onValueChange={(value) => setSort(prev => ({ ...prev, field: value as any }))}
                >
                  <SelectTrigger id="sort-field" className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confidence">Confidence</SelectItem>
                    <SelectItem value="created_at">Created Time</SelectItem>
                    <SelectItem value="expires_at">Expiry Time</SelectItem>
                    <SelectItem value="trade_pnl">P&L</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="sort-direction" className="text-sm">Direction</Label>
                <Select
                  value={sort.direction}
                  onValueChange={(value) => setSort(prev => ({ ...prev, direction: value as any }))}
                >
                  <SelectTrigger id="sort-direction" className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Badges */}
      {Object.values(filters).some(filter => filter && filter.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {filters.market && filters.market.length > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Market: {filters.market.join(', ')}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('market', undefined)} />
            </Badge>
          )}
          {filters.direction && filters.direction.length > 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Direction: {filters.direction.join(', ')}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('direction', undefined)} />
            </Badge>
          )}
          {filters.status && filters.status.length > 0 && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              Status: {filters.status.join(', ')}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('status', undefined)} />
            </Badge>
          )}
          {(filters.confidenceMin !== undefined || filters.confidenceMax !== undefined) && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Confidence: {(filters.confidenceMin || 0)}% - {(filters.confidenceMax || 100)}%
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => {
                handleFilterChange('confidenceMin', undefined);
                handleFilterChange('confidenceMax', undefined);
              }} />
            </Badge>
          )}
          {filters.myTrades && (
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              My Trades Only
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('myTrades', false)} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
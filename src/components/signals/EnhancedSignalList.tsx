import React from 'react';
import { useSignalList } from '@/hooks/useSignalList';
import { EnhancedSignalCard } from './EnhancedSignalCard';
import { SignalFilters } from './SignalFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

interface EnhancedSignalListProps {
  defaultView?: 'all' | 'my-trades';
}

export const EnhancedSignalList: React.FC<EnhancedSignalListProps> = ({ defaultView = 'all' }) => {
  const {
    signals,
    isLoading,
    isRefreshing,
    filters,
    setFilters,
    sort,
    setSort,
    pagination,
    refreshSignals,
    loadMore,
    clearFilters,
    hasMore
  } = useSignalList();

  React.useEffect(() => {
    if (defaultView === 'my-trades') {
      setFilters(prev => ({ ...prev, myTrades: true }));
    } else {
      setFilters(prev => ({ ...prev, myTrades: false }));
    }
  }, [defaultView, setFilters]);

  const handleViewToggle = (view: 'all' | 'my-trades') => {
    setFilters(prev => ({ ...prev, myTrades: view === 'my-trades' }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Enhanced Signal List</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {filters.myTrades ? 'Your executed trades and their performance' : 'All available trading signals'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={defaultView === 'all' ? 'default' : 'outline'}
              onClick={() => handleViewToggle('all')}
              className="flex items-center gap-2"
            >
              All Signals
            </Button>
            <Button
              variant={defaultView === 'my-trades' ? 'default' : 'outline'}
              onClick={() => handleViewToggle('my-trades')}
              className="flex items-center gap-2"
            >
              My Trades
            </Button>
            <Button
              variant="outline"
              onClick={() => refreshSignals(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            Showing {signals.length} signal{signals.length !== 1 ? 's' : ''} 
            {pagination.total > 0 && ` of ${pagination.total} total`}
            {filters.myTrades && ' (your trades only)'}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <SignalFilters />

      {/* Signals Grid */}
      <div className="space-y-4">
        {isLoading && signals.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : signals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {filters.myTrades ? 'No trades found' : 'No signals available'}
              </h3>
              <p className="text-gray-600 mb-6">
                {filters.myTrades 
                  ? 'You haven\'t executed any trades yet. Start trading to see your trade history here.'
                  : 'No signals match your current filters. Try adjusting your filters or check back later.'
                }
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {signals.map((signal) => (
                <EnhancedSignalCard
                  key={signal.id}
                  signal={signal}
                  onApprove={(s) => {
                    // Handle trade approval
                    console.log('Trade approved for signal:', s.id);
                  }}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center py-6">
                <Button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Signals'
                  )}
                </Button>
              </div>
            )}

            {/* End of Results */}
            {!hasMore && signals.length > 0 && (
              <div className="text-center text-gray-500 py-4">
                You've reached the end of the signal list.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeposits } from '@/hooks/useDeposits';
import { ArrowDown, ArrowUp, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export const TransactionHistory = () => {
  const { deposits, withdrawals, loading } = useDeposits();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'credited':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      case 'requested':
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
      case 'credited':
        return 'default';
      case 'failed':
      case 'cancelled':
        return 'destructive';
      case 'pending':
      case 'requested':
      case 'processing':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Loading transaction history...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Combine and sort all transactions
  const allTransactions = [
    ...deposits.map(d => ({ ...d, type: 'deposit' as const })),
    ...withdrawals.map(w => ({ ...w, type: 'withdrawal' as const }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          Your deposit and withdrawal history across all networks
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found. Start by making a deposit or withdrawal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.map((tx) => (
                  <TableRow key={`${tx.type}-${tx.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tx.type === 'deposit' ? (
                          <ArrowDown className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowUp className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="capitalize">{tx.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {tx.amount} {tx.asset}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tx.chain === 'tron' ? 'Tron' : 'Polygon'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tx.type === 'deposit' 
                        ? formatAddress(tx.from_address || '') 
                        : formatAddress('destination_address' in tx ? tx.destination_address : '')
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(tx.status)} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(tx.status)}
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tx.created_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
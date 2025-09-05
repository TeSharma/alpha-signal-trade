import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeposits } from '@/hooks/useDeposits';
import { useToast } from '@/hooks/use-toast';
import { isValidTronAddress } from '@/lib/tronweb';
import { ArrowUp, AlertCircle } from 'lucide-react';

export const WithdrawalInterface = () => {
  const [amount, setAmount] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [chain, setChain] = useState<string>('tron');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createWithdrawal } = useDeposits();
  const { toast } = useToast();

  const validateAddress = (address: string) => {
    if (chain === 'tron') {
      return isValidTronAddress(address);
    }
    // For Polygon, basic ETH address validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleWithdraw = async () => {
    if (!amount || !destinationAddress) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (!validateAddress(destinationAddress)) {
      toast({
        title: "Error",
        description: `Invalid ${chain === 'tron' ? 'Tron' : 'Polygon'} address`,
        variant: "destructive"
      });
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount < 5) {
      toast({
        title: "Error",
        description: "Minimum withdrawal is 5 USDT",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createWithdrawal({
        chain,
        asset: 'USDT',
        amount: withdrawAmount,
        destination_address: destinationAddress,
        metadata: {
          requested_at: new Date().toISOString()
        }
      });

      // Reset form
      setAmount('');
      setDestinationAddress('');
      
      toast({
        title: "Withdrawal Requested",
        description: "Your withdrawal request has been submitted for processing"
      });
    } catch (error) {
      console.error('Error submitting withdrawal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFeeInfo = () => {
    if (chain === 'tron') {
      return { fee: '1 USDT', time: '5-15 minutes' };
    }
    return { fee: '2-5 USDT', time: '15-30 minutes' };
  };

  const { fee, time } = getFeeInfo();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUp className="h-5 w-5" />
          Withdraw USDT
        </CardTitle>
        <CardDescription>
          Withdraw USDT to your external wallet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="chain">Network</Label>
          <Select value={chain} onValueChange={(value: string) => setChain(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tron">Tron (TRC-20) - Lower fees</SelectItem>
              <SelectItem value="polygon">Polygon (ERC-20) - Faster settlement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="amount">Amount (USDT)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="5"
            step="0.01"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Minimum: 5 USDT | Fee: {fee}
          </p>
        </div>

        <div>
          <Label htmlFor="destinationAddress">
            Destination Address ({chain === 'tron' ? 'Tron' : 'Polygon'})
          </Label>
          <Input
            id="destinationAddress"
            placeholder={
              chain === 'tron' 
                ? 'TYASr5UV6HEcXatwdFQT1HQQGmKFu4rEWB' 
                : '0x742d35cc6678c95f6b3389e8e0e7d29e0b2c19f2'
            }
            value={destinationAddress}
            onChange={(e) => setDestinationAddress(e.target.value)}
          />
          {destinationAddress && !validateAddress(destinationAddress) && (
            <p className="text-xs text-destructive mt-1">
              Invalid {chain === 'tron' ? 'Tron' : 'Polygon'} address format
            </p>
          )}
        </div>

        <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">Withdrawal Info:</p>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Processing time: {time}</li>
                <li>• Network fee: {fee}</li>
                <li>• Withdrawals are processed manually</li>
                <li>• Double-check your address before submitting</li>
              </ul>
            </div>
          </div>
        </div>

        <Button
          onClick={handleWithdraw}
          disabled={isSubmitting || !amount || !destinationAddress || !validateAddress(destinationAddress)}
          className="w-full"
        >
          {isSubmitting ? "Processing..." : "Request Withdrawal"}
        </Button>
      </CardContent>
    </Card>
  );
};
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeposits } from '@/hooks/useDeposits';
import { useToast } from '@/hooks/use-toast';
import { Copy, QrCode, ArrowDown, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode';

// Mock hot wallet address - in production this would come from your backend
const HOT_WALLET_ADDRESS = 'TYASr5UV6HEcXatwdFQT1HQQGmKFu4rEWB';

export const DepositInterface = () => {
  const [amount, setAmount] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { createDeposit } = useDeposits();
  const { toast } = useToast();

  const generateQRCode = async () => {
    try {
      const qrData = `${HOT_WALLET_ADDRESS}`;
      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrDataUrl(dataUrl);
      setShowQR(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Address copied to clipboard"
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "Failed to copy address",
        variant: "destructive"
      });
    }
  };

  const handleManualDeposit = async () => {
    if (!amount || !fromAddress || !txHash) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createDeposit({
        chain: 'tron',
        asset: 'USDT',
        amount: parseFloat(amount),
        from_address: fromAddress,
        to_address: HOT_WALLET_ADDRESS,
        tx_hash: txHash,
        metadata: {
          type: 'manual_submission'
        }
      });

      // Reset form
      setAmount('');
      setFromAddress('');
      setTxHash('');
      
      toast({
        title: "Deposit Submitted",
        description: "Your deposit has been submitted for processing"
      });
    } catch (error) {
      console.error('Error submitting deposit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDown className="h-5 w-5" />
          Deposit USDT
        </CardTitle>
        <CardDescription>
          Deposit TRC-20 USDT to your trading account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="address" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="address">Deposit Address</TabsTrigger>
            <TabsTrigger value="manual">Manual Submission</TabsTrigger>
          </TabsList>

          <TabsContent value="address" className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Deposit Address (TRC-20)</Label>
                  <Badge variant="secondary">Tron Network</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background border rounded text-sm font-mono break-all">
                    {HOT_WALLET_ADDRESS}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(HOT_WALLET_ADDRESS)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={generateQRCode}
                  className="flex-1"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Show QR Code
                </Button>
              </div>

              {showQR && qrDataUrl && (
                <div className="flex justify-center p-4 border rounded-lg bg-white">
                  <img src={qrDataUrl} alt="Deposit Address QR Code" className="w-48 h-48" />
                </div>
              )}

              <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800">Important Notes:</p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• Only send TRC-20 USDT to this address</li>
                      <li>• Minimum deposit: 1 USDT</li>
                      <li>• Deposits are processed automatically</li>
                      <li>• Network fee: ~1-3 TRX</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (USDT)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="fromAddress">Your Tron Address</Label>
                <Input
                  id="fromAddress"
                  placeholder="TYASr5UV6HEcXatwdFQT1HQQGmKFu4rEWB"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="txHash">Transaction Hash</Label>
                <Input
                  id="txHash"
                  placeholder="Enter transaction hash after sending"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
              </div>

              <Button
                onClick={handleManualDeposit}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Submitting..." : "Submit Deposit"}
              </Button>

              <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Manual Process:</strong> First send USDT to the deposit address above, 
                  then return here to submit the transaction details for faster processing.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
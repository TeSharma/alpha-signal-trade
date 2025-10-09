import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Rocket, Code, Database, Link as LinkIcon } from 'lucide-react';

export const DeploymentGuide = () => {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Smart Contract Deployment Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Code className="h-4 w-4" />
          <AlertTitle>Phase 1: Token Infrastructure (In Progress)</AlertTitle>
          <AlertDescription>
            Smart contracts have been created. Follow the steps below to deploy them.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Step 1</Badge>
              <h3 className="font-semibold">Deploy TokenizedCurrency Contracts</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Deploy 8 ERC-20 tokens for each currency:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• tUSD (Tokenized USD)</li>
              <li>• tEUR (Tokenized Euro)</li>
              <li>• tGBP (Tokenized Pound)</li>
              <li>• tJPY (Tokenized Yen)</li>
              <li>• tAUD (Tokenized Australian Dollar)</li>
              <li>• tCAD (Tokenized Canadian Dollar)</li>
              <li>• tCHF (Tokenized Swiss Franc)</li>
              <li>• tNZD (Tokenized New Zealand Dollar)</li>
            </ul>
            <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
              Location: src/contracts/TokenizedCurrency.sol
            </div>
          </div>

          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Step 2</Badge>
              <h3 className="font-semibold">Deploy PriceOracle Contract</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Deploy oracle contract and configure Chainlink price feeds for each pair:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• EUR/USD</li>
              <li>• GBP/USD</li>
              <li>• USD/JPY</li>
              <li>• AUD/USD</li>
              <li>• USD/CAD</li>
              <li>• USD/CHF</li>
              <li>• NZD/USD</li>
            </ul>
            <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
              Location: src/contracts/PriceOracle.sol
            </div>
          </div>

          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Step 3</Badge>
              <h3 className="font-semibold">Deploy TradingPlatform Contract</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Deploy main trading contract with oracle and collateral token addresses
            </p>
            <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
              Location: src/contracts/TradingPlatform.sol
            </div>
          </div>

          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Step 4</Badge>
              <h3 className="font-semibold">Update Contract Addresses</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              After deployment, update the following file with deployed addresses:
            </p>
            <div className="mt-3 p-3 bg-muted rounded text-xs font-mono">
              Location: src/hooks/useTokenContracts.ts
            </div>
          </div>

          <Alert className="bg-primary/5 border-primary/20">
            <Database className="h-4 w-4" />
            <AlertTitle>Required Dependencies</AlertTitle>
            <AlertDescription>
              Install OpenZeppelin and Chainlink contracts:
              <div className="mt-2 p-2 bg-background rounded text-xs font-mono">
                npm install @openzeppelin/contracts @chainlink/contracts
              </div>
            </AlertDescription>
          </Alert>

          <Alert className="bg-blue-500/5 border-blue-500/20">
            <LinkIcon className="h-4 w-4 text-blue-500" />
            <AlertTitle>Chainlink Price Feeds (Polygon)</AlertTitle>
            <AlertDescription className="text-xs mt-2">
              <a 
                href="https://docs.chain.link/data-feeds/price-feeds/addresses?network=polygon" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                View Polygon Mainnet Price Feed Addresses →
              </a>
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
};

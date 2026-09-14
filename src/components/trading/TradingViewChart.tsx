import React, { useEffect, useRef, useState, memo } from 'react';

interface TradingViewChartProps {
  pair: string;
  height?: number;
  theme?: 'light' | 'dark';
}

// Map our internal pair format to TradingView symbols
const TV_SYMBOL_MAP: Record<string, string> = {
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT',
  'POL/USD': 'BINANCE:POLUSDT',
  'EUR/USD': 'FX:EURUSD',
  'GBP/USD': 'FX:GBPUSD',
  'USD/JPY': 'FX:USDJPY',
  'AUD/USD': 'FX:AUDUSD',
  'XAU/USD': 'OANDA:XAUUSD',
};

const TradingViewChart: React.FC<TradingViewChartProps> = ({ pair, height = 500, theme = 'light' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const symbol = TV_SYMBOL_MAP[pair] || 'BINANCE:BTCUSDT';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setFailed(false);
    container.innerHTML = '';

    // TradingView injects its iframe as a sibling of the script, so it needs a
    // dedicated wrapper with an explicit size for `autosize` to resolve.
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    container.appendChild(widget);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onerror = () => setFailed(true);
    script.text = JSON.stringify({
      autosize: true,
      symbol,
      interval: '30',
      timezone: 'Etc/UTC',
      theme,
      style: '1',
      locale: 'en',
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [symbol, theme]);

  return (
    <div
      className="tradingview-widget-container w-full rounded-md border border-border overflow-hidden relative"
      style={{ height }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card text-center p-4">
          <p className="text-sm text-muted-foreground">
            The chart could not load. An ad blocker or network restriction may be blocking it.
          </p>
          <a
            className="text-sm text-primary underline"
            href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open {pair} chart on TradingView
          </a>
        </div>
      )}
    </div>
  );
};

export default memo(TradingViewChart);

import React, { useEffect, useRef, memo } from 'react';

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
};

const TradingViewChart: React.FC<TradingViewChartProps> = ({ pair, height = 500, theme = 'dark' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const symbol = TV_SYMBOL_MAP[pair] || 'BINANCE:BTCUSDT';

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any prior widget instance
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
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
      studies: [],
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol, theme]);

  return (
    <div className="tradingview-widget-container w-full rounded-md border border-border overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

export default memo(TradingViewChart);

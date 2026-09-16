import React, { useEffect, useRef, useState, memo } from 'react';
import { Loader2 } from 'lucide-react';

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

type Status = 'loading' | 'ready' | 'failed';

const TradingViewChart: React.FC<TradingViewChartProps> = ({ pair, height = 500, theme = 'light' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const symbol = TV_SYMBOL_MAP[pair] || 'BINANCE:BTCUSDT';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setStatus('loading');
    container.innerHTML = '';

    // TradingView's embed script resolves its host like this:
    //   const parent = script.parentNode;
    //   const isContainer = parent.classList.contains('tradingview-widget-container');
    //   this.iframeContainer = isContainer ? parent : document.createElement('div');
    //   const widget = iframeContainer.querySelector('.tradingview-widget-container__widget');
    //
    // So the <script> MUST be appended directly into the element carrying the
    // `tradingview-widget-container` class, with `.tradingview-widget-container__widget`
    // as its sibling. If the parent lacks that class, TradingView falls back to a
    // brand-new unstyled <div>, the widget div is never found, and the iframe ends up
    // at `height: 100%` inside an auto-height (0px) box — i.e. an invisible chart.
    //
    // That is why `containerRef` below is applied to the element that also carries the
    // class, and why that element must not have React-rendered children (the effect
    // owns its contents and clears them on cleanup).
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    container.appendChild(widget);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onerror = () => {
      if (!cancelled) setStatus('failed');
    };
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

    // The widget script gives no ready callback — poll for the iframe it injects.
    const started = Date.now();
    const poll = window.setInterval(() => {
      if (cancelled) return;
      if (container.querySelector('iframe')) {
        setStatus('ready');
        window.clearInterval(poll);
      } else if (Date.now() - started > 10000) {
        setStatus('failed');
        window.clearInterval(poll);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      container.innerHTML = '';
    };
  }, [symbol, theme]);

  return (
    <div
      className="w-full rounded-md border border-border overflow-hidden relative bg-card"
      style={{ height }}
    >
      {/*
        TradingView-owned subtree. This element must carry the
        `tradingview-widget-container` class itself — the embed script looks up
        `script.parentNode` and bails to an unstyled fallback div if the class is
        missing. It must also render NO React children, because the effect injects
        the widget div + script here and clears the node on cleanup/re-symbol.
      */}
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height: '100%', width: '100%' }}
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading {pair} chart…</p>
        </div>
      )}

      {status === 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card text-center p-4">
          <p className="text-sm text-muted-foreground">
            The {pair} chart could not load. An ad blocker or network restriction may be blocking it.
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

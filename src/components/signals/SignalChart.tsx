import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineStyle, Time } from 'lightweight-charts';
import { Loader2 } from 'lucide-react';
import { SignalObject } from '@/types/signal';

interface SignalChartProps {
  signal: SignalObject;
  height?: number;
}

const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'BTC/USD': 'BTCUSDT',
  'ETH/USD': 'ETHUSDT',
  'POL/USD': 'MATICUSDT',
};

// Twelve Data symbol format matches our pairs (EUR/USD)
const FOREX_PAIRS = new Set(['EUR/USD', 'GBP/USD', 'USD/JPY']);

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

async function fetchBinanceKlines(symbol: string, interval = '30m', limit = 96): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
  const data = await res.json();
  return data.map((k: (string | number)[]) => ({
    time: (Math.floor(Number(k[0]) / 1000)) as Time,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }));
}

export const SignalChart: React.FC<SignalChartProps> = ({ signal, height = 220 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Read CSS variables for theming
    const styles = getComputedStyle(document.documentElement);
    const fg = `hsl(${styles.getPropertyValue('--foreground').trim()})`;
    const muted = `hsl(${styles.getPropertyValue('--muted-foreground').trim()})`;
    const border = `hsl(${styles.getPropertyValue('--border').trim()})`;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: muted,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: border, style: LineStyle.Dotted },
        horzLines: { color: border, style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addCandlestickSeries({
      upColor: 'hsl(142 76% 45%)',
      downColor: 'hsl(0 72% 51%)',
      borderVisible: false,
      wickUpColor: 'hsl(142 76% 45%)',
      wickDownColor: 'hsl(0 72% 51%)',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    let cancelled = false;
    const isCrypto = !!BINANCE_SYMBOL_MAP[signal.pair];
    const isForex = FOREX_PAIRS.has(signal.pair);

    async function load() {
      setLoading(true);
      setError(null);
      try {
        let candles: Candle[] = [];
        if (isCrypto) {
          candles = await fetchBinanceKlines(BINANCE_SYMBOL_MAP[signal.pair]);
        } else if (isForex) {
          // Twelve Data is rate-limited; show placeholder line built from current entry midpoint
          throw new Error('Forex chart unavailable in free tier');
        } else {
          throw new Error('Unsupported pair');
        }

        if (cancelled || !seriesRef.current || !chartRef.current) return;
        seriesRef.current.setData(candles);

        // Draw price lines for entry zone, SL, TP
        const [entryLow, entryHigh] = Array.isArray(signal.entry_zone)
          ? signal.entry_zone
          : [signal.entry_zone as unknown as number, signal.entry_zone as unknown as number];

        seriesRef.current.createPriceLine({
          price: entryLow,
          color: 'hsl(217 91% 60%)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Entry Low',
        });
        seriesRef.current.createPriceLine({
          price: entryHigh,
          color: 'hsl(217 91% 60%)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Entry High',
        });
        seriesRef.current.createPriceLine({
          price: signal.stop_loss,
          color: 'hsl(0 72% 51%)',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'SL',
        });

        const tps = Array.isArray(signal.take_profit) ? signal.take_profit : [signal.take_profit as unknown as number];
        tps.forEach((tp, i) => {
          seriesRef.current?.createPriceLine({
            price: tp,
            color: 'hsl(142 76% 45%)',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `TP${tps.length > 1 ? i + 1 : ''}`,
          });
        });

        chartRef.current.timeScale().fitContent();
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chart failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [signal]);

  return (
    <div className="relative w-full rounded-md border border-border bg-card/30">
      <div ref={containerRef} style={{ height }} className="w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-md">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
          {error}
        </div>
      )}
    </div>
  );
};

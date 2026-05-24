'use client';

import { usePrice } from '@/hooks/usePrice';

function formatUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toExponential(2)}`;
}

export function CoinStats() {
  const { coin: data, error, loading: isLoading } = usePrice();

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-ink-700 bg-ink-800/60 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Loading market cap...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-ink-700 bg-ink-800/60 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Market cap</p>
        <p className="mt-2 text-sm text-zinc-400">
          Couldn&rsquo;t reach Pump.fun yet. Market cap will show once the coin endpoint is available.
        </p>
      </div>
    );
  }

  const pumpUrl = `https://pump.fun/coin/${data.mint}`;

  return (
    <div className="gradient-border overflow-hidden rounded-3xl bg-ink-850/80 shadow-glow-strong backdrop-blur">
      <div className="relative flex flex-wrap items-center gap-4 px-6 pb-4 pt-5">
        {data.imageUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.imageUri}
            alt={data.name}
            className="h-12 w-12 rounded-xl border border-ink-700/80 object-cover shadow-sheen"
          />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-ink-700/80 bg-ink-900 font-display text-lg font-bold text-accent-400 shadow-sheen">
            $
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold tracking-tight text-zinc-100">
            {data.name}{' '}
            <span className="font-mono text-xs text-zinc-500">${data.symbol}</span>
          </p>
          <p className="font-mono text-xs text-zinc-500">
            {data.mint.slice(0, 6)}…{data.mint.slice(-6)}
          </p>
        </div>
        <a
          href={pumpUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-accent-500/40 bg-accent-500/5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-accent-300 transition hover:bg-accent-500/15 hover:text-white"
        >
          Pump.fun ↗
        </a>
      </div>

      <div className="relative overflow-hidden border-t border-ink-700/60 px-6 pb-7 pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-14 bottom-0 h-40 w-40 rounded-full bg-accent-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-mint-400/10 blur-3xl"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
          Live market cap
        </p>
        <p
          className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-accent-300 sm:text-5xl"
          data-numeric
        >
          {formatUsd(data.marketCapUsd)}
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useTopHolders } from '@/hooks/useTopHolders';
import { formatCompact } from '@/lib/format';

function shortAddr(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatUsdc(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '$0.00';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return '$0.00';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toExponential(2)}`;
}

function formatCountdown(target: number | null): string {
  if (!target) return '—';
  const ms = target - Date.now();
  if (ms <= 0) return 'any moment now';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export function EligibleHolders() {
  const { data, loading, error } = useTopHolders();
  // Force re-render every second so the countdown ticks.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="gradient-border relative overflow-hidden rounded-3xl bg-ink-850/70 shadow-glow backdrop-blur">
      <div className="relative flex flex-wrap items-end justify-between gap-4 border-b border-ink-700/60 px-6 py-5 md:px-8">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-300">
            The list
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Top {data?.topN ?? 20} eligible holders
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Holders ranked by $stablecasino balance. Every{' '}
            <span className="font-semibold text-zinc-200">
              {data ? Math.round(data.airdropIntervalMs / 60_000) : 30} minutes
            </span>{' '}
            the casino sends the airdrop pool to these wallets in USDC,
            proportional to their share of the top {data?.topN ?? 20}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-right text-xs">
          <span className="font-mono uppercase tracking-[0.18em] text-zinc-500">Pending pool</span>
          <span
            className="font-display text-base font-semibold text-mint-400"
            data-numeric
          >
            {data ? formatUsdc(data.pendingAirdropPoolUsdc) : '—'}
          </span>
          <span className="font-mono uppercase tracking-[0.18em] text-zinc-500">Next airdrop</span>
          <span
            className="font-display text-base font-semibold text-gold-400"
            data-numeric
          >
            {data?.nextAirdropAt
              ? formatCountdown(data.nextAirdropAt)
              : 'on next collection'}
          </span>
        </div>
      </div>

      {loading && !data ? (
        <div className="px-6 py-10 text-center text-sm text-zinc-500 md:px-8">
          Loading holders…
        </div>
      ) : null}

      {error && !data ? (
        <div className="px-6 py-10 text-center text-sm text-zinc-500 md:px-8">
          Couldn&rsquo;t fetch holders right now. The list updates once the
          coin is launched and on-chain accounts exist.
        </div>
      ) : null}

      {data && data.holders.length === 0 && !loading ? (
        <div className="px-6 py-10 text-center text-sm text-zinc-500 md:px-8">
          No eligible holders found yet. Once people start buying ${'STABLECASINO'},
          this list will populate.
        </div>
      ) : null}

      {data && data.holders.length > 0 ? (
        <div className="grid grid-cols-1 gap-px bg-ink-700/40 sm:grid-cols-2 lg:grid-cols-2">
          {data.holders.map((h) => (
            <HolderRow
              key={h.tokenAccount}
              rank={h.rank}
              owner={h.owner}
              balance={h.balance}
              share={h.share}
              payoutUsdc={h.estimatedNextPayoutUsdc}
            />
          ))}
        </div>
      ) : null}

      <div className="border-t border-ink-700/60 px-6 py-4 text-[10px] uppercase tracking-wider text-zinc-500 md:px-8">
        Bankroll, burn address, Pump.fun creator and bonding-curve wallets are
        excluded from this list.
      </div>
    </section>
  );
}

function HolderRow({
  rank,
  owner,
  balance,
  share,
  payoutUsdc,
}: {
  rank: number;
  owner: string;
  balance: string;
  share: number;
  payoutUsdc: string;
}) {
  const explorer = `https://solscan.io/account/${owner}`;
  const podiumStyle =
    rank === 1
      ? 'border-gold-400/60 bg-gold-400/10 text-gold-300'
      : rank === 2
      ? 'border-zinc-400/40 bg-zinc-400/10 text-zinc-200'
      : rank === 3
      ? 'border-ember-400/40 bg-ember-400/10 text-ember-400'
      : 'border-accent-500/30 bg-accent-500/10 text-accent-300';
  return (
    <div className="group flex items-center gap-4 bg-ink-850/80 px-5 py-3 transition-colors hover:bg-ink-800/80">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-display text-xs font-bold ${podiumStyle}`}
      >
        #{rank}
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-mono text-xs text-zinc-200 transition-colors hover:text-accent-300"
          title={owner}
        >
          {shortAddr(owner)}
        </a>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          {(share * 100).toFixed(2)}% of top
        </p>
      </div>
      <div className="text-right">
        <p
          className="font-display text-sm font-semibold tracking-tight text-zinc-100"
          data-numeric
        >
          {formatCompact(balance)}{' '}
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            STABLE
          </span>
        </p>
        <p className="font-mono text-[10px] text-mint-400" data-numeric>
          ≈ {formatUsdc(payoutUsdc)} USDC
        </p>
      </div>
    </div>
  );
}

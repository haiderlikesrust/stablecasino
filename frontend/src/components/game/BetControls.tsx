'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCompact, formatUsdCompact } from '@/lib/format';
import { usePrice } from '@/hooks/usePrice';

const ticker = process.env.NEXT_PUBLIC_TOKEN_TICKER ?? 'STABLECASINO';

interface Props {
  minBetStable: string | null;
  maxBetStable: string | null;
  minBetUsdc: string;
  maxBetUsdc: string;
  disabled?: boolean;
  onStart: (betStable: number) => void | Promise<void>;
}

export function BetControls({
  minBetStable,
  maxBetStable,
  minBetUsdc,
  maxBetUsdc,
  disabled,
  onStart,
}: Props) {
  const { price } = usePrice();
  const min = Number(minBetStable ?? '0');
  const max = Number(maxBetStable ?? '0');

  const [value, setValue] = useState<string>(() => (max > 0 ? max.toString() : ''));

  // Snap to a sensible default whenever the bounds change (e.g. bankroll moved).
  useEffect(() => {
    if (max > 0 && (value === '' || Number(value) > max || Number(value) < min)) {
      setValue(max.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max, min]);

  const numericValue = Number(value);
  const usdcEquivalent = useMemo(() => {
    if (!price || !numericValue || !Number.isFinite(numericValue)) return null;
    return numericValue * price;
  }, [numericValue, price]);

  const tooLow = numericValue < min;
  const tooHigh = numericValue > max;
  const invalid = !Number.isFinite(numericValue) || numericValue <= 0 || tooLow || tooHigh;

  return (
    <div className="gradient-border rounded-2xl bg-ink-850/70 p-6 shadow-sheen backdrop-blur">
      <p className="font-display text-base font-bold tracking-tight text-zinc-100">
        Place your bet
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Min <span data-numeric>{formatCompact(minBetStable)}</span> {ticker} (~
        <span data-numeric>{formatUsdCompact(minBetUsdc)}</span>) &middot; Max{' '}
        <span data-numeric>{formatCompact(maxBetStable)}</span> {ticker} (~
        <span data-numeric>{formatUsdCompact(maxBetUsdc)}</span>)
      </p>

      <div className="mt-4 flex items-stretch gap-2">
        <div className="flex w-full items-center rounded-xl border border-ink-600/80 bg-ink-900/80 px-3 focus-within:border-accent-400 focus-within:shadow-[0_0_0_3px_rgba(74,152,238,0.15)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            {ticker}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step="any"
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-transparent px-3 py-3 text-right font-display text-2xl font-semibold tracking-tight text-zinc-100 outline-none"
            data-numeric
          />
        </div>
      </div>

      <p
        className={`mt-2 text-right text-xs ${
          tooHigh ? 'text-ember-400' : tooLow ? 'text-gold-400' : 'text-zinc-400'
        }`}
      >
        {price ? (
          <>
            ≈{' '}
            <span className="font-mono" data-numeric>
              {formatUsdCompact(usdcEquivalent)}
            </span>{' '}
            at{' '}
            <span className="font-mono" data-numeric>
              ${price.toExponential(3)}
            </span>{' '}
            / {ticker}
          </>
        ) : (
          'Waiting for live price…'
        )}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <button
            key={p}
            type="button"
            disabled={max <= 0}
            onClick={() => setValue((max * p).toFixed(6))}
            className="rounded-lg border border-ink-600/70 bg-ink-900/60 py-2 font-display font-medium text-zinc-300 transition hover:border-accent-400 hover:text-accent-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {Math.round(p * 100)}%
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || invalid || max <= 0}
        onClick={() => onStart(numericValue)}
        className="group relative mt-5 inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-accent-400 to-accent-600 px-4 py-3 font-display font-semibold text-ink-950 shadow-glow-strong transition hover:from-accent-300 hover:to-accent-500 disabled:cursor-not-allowed disabled:from-ink-600 disabled:to-ink-700 disabled:text-zinc-500 disabled:opacity-70 disabled:shadow-none"
      >
        <span className="relative z-10">Deal me in</span>
        <span
          aria-hidden
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full group-disabled:hidden"
        />
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        On submit you&rsquo;ll sign a transaction transferring your ${ticker} bet to the
        bankroll. Lost bets are burned; wins are paid out in USDC at the price locked when you
        dealt.
      </p>
    </div>
  );
}

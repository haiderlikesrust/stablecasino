'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useBurnStats } from '@/hooks/useBurnStats';
import { formatCompact, formatUsdCompact } from '@/lib/format';

function formatRelative(ts: number | null | undefined): string {
  if (!ts) return 'no burns yet';
  const ms = Date.now() - ts;
  if (ms < 30_000) return 'seconds ago';
  if (ms < 60_000) return 'less than a minute ago';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

/**
 * Smoothly tween a numeric counter towards `target`. Renders nothing visible
 * by itself; returns the current animated value so the caller can format it.
 */
function useAnimatedNumber(target: number, durationMs = 1200): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

/**
 * Stable across SSR/CSR: deterministic ember positions so we don't get
 * hydration mismatches. 14 embers drifting up from the furnace base.
 */
function EmberField() {
  const embers = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const left = (i * 67 + 13) % 100;
        const dx = ((i * 53) % 30) - 15;
        const size = 6 + ((i * 17) % 8);
        const delay = (i * 0.23) % 3.4;
        const duration = 2.6 + ((i * 11) % 12) / 10;
        return { left, dx, size, delay, duration, key: i };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((e) => (
        <span
          key={e.key}
          className="ember"
          style={{
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            animationDelay: `${e.delay}s`,
            animationDuration: `${e.duration}s`,
            ['--ember-dx' as string]: `${e.dx}px`,
          }}
        />
      ))}
      <span className="flame-core" />
    </div>
  );
}

export function BurnTracker() {
  const { stats, loading, error } = useBurnStats();
  const target = stats ? Number(stats.totalBurned) : 0;
  const animated = useAnimatedNumber(Number.isFinite(target) ? target : 0);
  const usdTarget = stats?.totalBurnedUsdc ?? 0;
  const animatedUsd = useAnimatedNumber(Number.isFinite(usdTarget) ? usdTarget : 0);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-ember-500/25 bg-gradient-to-br from-ink-900 via-ink-850 to-ink-900 shadow-[0_0_60px_-20px_rgba(239,68,68,0.45)]">
      {/* warm gradient overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at 80% 100%, rgba(220, 38, 38, 0.18), transparent 55%), radial-gradient(ellipse at 20% 110%, rgba(251, 146, 60, 0.18), transparent 50%)',
        }}
      />

      <div className="relative grid gap-8 p-8 md:grid-cols-[1fr_280px] md:gap-10 md:p-10">
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-ember-400">
              The Furnace
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
              Total $stablecasino burned
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              Every decisive blackjack hand sends its staked $stablecasino into
              the incinerator address. The supply you see below is gone
              forever &mdash; permanently reducing the float.
            </p>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                Burned supply
              </p>
              <p
                className="font-display text-5xl font-bold leading-none tracking-tightest text-zinc-50 md:text-6xl"
                data-numeric
              >
                {loading && !stats ? '—' : formatCompact(animated)}
                <span className="ml-2 font-mono text-sm font-medium uppercase tracking-[0.18em] text-ember-400/90">
                  $STABLE
                </span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                USDC value destroyed
              </p>
              <p
                className="font-display text-3xl font-semibold tracking-tight text-mint-400 md:text-4xl"
                data-numeric
              >
                {stats?.totalBurnedUsdc === null
                  ? '—'
                  : formatUsdCompact(animatedUsd)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span>
              <span className="text-zinc-300">{stats?.burnCount ?? 0}</span>{' '}
              hands burnt
            </span>
            <span aria-hidden>·</span>
            <span>
              Last burn{' '}
              <span className="text-zinc-300">
                {formatRelative(stats?.lastBurnAt)}
              </span>
            </span>
            <span aria-hidden>·</span>
            <span>
              Live price{' '}
              <span className="text-zinc-300">
                {stats?.priceUsdPerStable
                  ? `$${stats.priceUsdPerStable.toFixed(8)}`
                  : '—'}
              </span>
            </span>
            {error ? (
              <span className="text-red-300/80">
                · refreshing failed, showing last snapshot
              </span>
            ) : null}
          </div>

          {stats && stats.recent.length > 0 ? (
            <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Recent burns
              </p>
              <ul className="mt-2 grid gap-1 font-mono text-xs text-zinc-400 sm:grid-cols-2">
                {stats.recent.slice(0, 6).map((b) => (
                  <li
                    key={`${b.txSignature ?? b.reference ?? b.createdAt}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-red-300/90">
                      − {formatCompact(b.amount)}
                    </span>
                    <span className="truncate text-zinc-500">
                      {b.txSignature
                        ? `${b.txSignature.slice(0, 6)}…${b.txSignature.slice(-4)}`
                        : formatRelative(b.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Furnace visual */}
        <div className="relative mx-auto h-72 w-full max-w-[280px] md:h-80">
          <div className="absolute inset-0 rounded-3xl border border-ember-500/30 bg-gradient-to-b from-ink-900 to-black/80 shadow-inner" />
          <EmberField />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-3xl bg-gradient-to-t from-ember-600/40 via-ember-400/15 to-transparent" />
          <div className="pointer-events-none absolute bottom-3 left-1/2 h-1.5 w-3/5 -translate-x-1/2 rounded-full bg-ember-400/40 blur-md" />
        </div>
      </div>
    </section>
  );
}

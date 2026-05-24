'use client';

import { GameSnapshot } from '@/lib/api';
import { PlayingCard } from './PlayingCard';

interface Props {
  game: GameSnapshot | null;
  busy?: boolean;
}

export function BlackjackTable({ game, busy }: Props) {
  return (
    <div className="felt gradient-border relative w-full overflow-hidden rounded-3xl p-8 shadow-glow-strong">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-300">
          Dealer
        </p>
        {game ? (
          <p
            className="font-display text-lg font-semibold tracking-tight text-zinc-200"
            data-numeric
          >
            {game.dealer.hiddenCount > 0 ? '?' : game.dealer.total}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {game ? (
          <>
            {game.dealer.cards.map((c, i) => (
              <PlayingCard key={`d-${i}-${c.raw}`} card={c} />
            ))}
            {Array.from({ length: game.dealer.hiddenCount }).map((_, i) => (
              <PlayingCard key={`d-h-${i}`} hidden />
            ))}
          </>
        ) : (
          <>
            <PlayingCard hidden />
            <PlayingCard hidden />
          </>
        )}
      </div>

      <div className="my-8 h-px bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />

      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-mint-400">
          You
        </p>
        {game ? (
          <p
            className="font-display text-lg font-semibold tracking-tight text-zinc-200"
            data-numeric
          >
            {game.player.total}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {game ? (
          game.player.cards.map((c, i) => (
            <PlayingCard key={`p-${i}-${c.raw}`} card={c} />
          ))
        ) : (
          <p className="text-sm text-zinc-500">Place a bet to deal a hand.</p>
        )}
      </div>

      {game?.state === 'SETTLED' ? (
        <OutcomeBanner outcome={game.outcome} payout={game.payoutUsdc} />
      ) : null}

      {busy ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full border border-accent-500/40 bg-ink-900/80 px-4 py-2 text-sm text-accent-300 shadow-glow">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent-400/70" />
              <span className="relative h-2 w-2 rounded-full bg-accent-400" />
            </span>
            Working…
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OutcomeBanner({ outcome, payout }: { outcome: string | null; payout: string | null }) {
  if (!outcome) return null;
  const label =
    outcome === 'BLACKJACK'
      ? 'Blackjack!'
      : outcome === 'WIN'
        ? 'You win'
        : outcome === 'BUST_DEALER'
          ? 'Dealer busts'
          : outcome === 'PUSH'
            ? 'Push'
            : outcome === 'BUST_PLAYER'
              ? 'Bust'
              : 'Dealer wins';

  const positive = ['BLACKJACK', 'WIN', 'BUST_DEALER'].includes(outcome);
  const neutral = outcome === 'PUSH';
  return (
    <div
      className={`mt-8 rounded-2xl border px-5 py-4 text-center font-display text-xl font-bold tracking-tight shadow-sheen ${
        positive
          ? 'border-mint-500/60 bg-mint-500/15 text-mint-300 shadow-mint'
          : neutral
            ? 'border-ink-600 bg-ink-900/60 text-zinc-200'
            : 'border-ember-500/50 bg-ember-500/10 text-ember-400'
      }`}
    >
      {label}
      {payout ? (
        <span className="ml-3 font-mono text-sm font-medium text-zinc-300" data-numeric>
          payout ref {payout} (base units)
        </span>
      ) : null}
    </div>
  );
}

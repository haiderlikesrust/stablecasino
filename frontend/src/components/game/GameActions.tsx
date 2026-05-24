'use client';

import { GameSnapshot } from '@/lib/api';

interface Props {
  game: GameSnapshot | null;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSettle: () => void;
  onNewHand: () => void;
  busy?: boolean;
}

export function GameActions({ game, onHit, onStand, onDouble, onSettle, onNewHand, busy }: Props) {
  if (!game) return null;

  if (game.state === 'PLAYER_TURN') {
    const canDouble = game.player.cards.length === 2 && !game.doubled;
    return (
      <div className="grid grid-cols-3 gap-3">
        <ActionBtn label="Hit" onClick={onHit} busy={busy} />
        <ActionBtn label="Stand" emphasis onClick={onStand} busy={busy} />
        <ActionBtn label="Double" onClick={onDouble} disabled={!canDouble} busy={busy} />
      </div>
    );
  }

  if (game.state === 'SETTLED') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <ActionBtn label="Settle on-chain" emphasis onClick={onSettle} busy={busy} />
        <ActionBtn label="New hand" onClick={onNewHand} busy={busy} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-3 text-center text-sm text-zinc-400">
      Dealer is playing...
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  busy,
  emphasis,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`rounded-xl px-4 py-3 font-display text-sm font-semibold tracking-tight transition disabled:cursor-not-allowed disabled:opacity-40 ${
        emphasis
          ? 'bg-gradient-to-b from-accent-400 to-accent-600 text-ink-950 shadow-glow-strong hover:from-accent-300 hover:to-accent-500'
          : 'border border-ink-600/80 bg-ink-900/60 text-zinc-100 shadow-sheen hover:border-accent-400 hover:text-accent-300'
      }`}
    >
      {label}
    </button>
  );
}

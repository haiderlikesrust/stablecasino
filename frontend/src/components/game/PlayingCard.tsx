'use client';

import { CardInfo } from '@/lib/api';

const SUIT_MAP: Record<string, { symbol: string; isRed: boolean }> = {
  S: { symbol: '♠', isRed: false },
  H: { symbol: '♥', isRed: true },
  D: { symbol: '♦', isRed: true },
  C: { symbol: '♣', isRed: false },
};

export function PlayingCard({ card, hidden }: { card?: CardInfo; hidden?: boolean }) {
  if (hidden || !card) {
    return (
      <div className="animate-deal h-32 w-24 rounded-xl border border-accent-500/20 bg-gradient-to-br from-ink-700 to-ink-900 shadow-md">
        <div className="m-2 h-[calc(100%-1rem)] rounded-lg border border-accent-500/30 bg-[repeating-linear-gradient(45deg,_rgba(16,185,129,0.12)_0,_rgba(16,185,129,0.12)_6px,_transparent_6px,_transparent_12px)]" />
      </div>
    );
  }
  const rank = card.label.slice(0, card.label.length - 1);
  const suitChar = card.label.slice(-1);
  const { symbol, isRed } = SUIT_MAP[suitChar] ?? { symbol: '?', isRed: false };
  return (
    <div className="card-face animate-deal flex h-32 w-24 flex-col justify-between rounded-xl p-2 shadow-md ring-1 ring-accent-500/20">
      <span className={`font-display text-xl font-bold ${isRed ? 'text-red-600' : 'text-accent-700'}`}>
        {rank}
        <span className="ml-0.5">{symbol}</span>
      </span>
      <span className={`self-center text-3xl ${isRed ? 'text-red-600' : 'text-accent-700'}`}>
        {symbol}
      </span>
      <span
        className={`self-end rotate-180 font-display text-xl font-bold ${isRed ? 'text-red-600' : 'text-accent-700'}`}
      >
        {rank}
        <span className="ml-0.5">{symbol}</span>
      </span>
    </div>
  );
}

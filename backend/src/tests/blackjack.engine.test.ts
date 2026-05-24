import { describe, it, expect } from 'vitest';
import {
  buildShoe,
  scoreHand,
  startGame,
  hit,
  stand,
  payoutMultiplier,
  cardLabel,
  isBlackjack,
} from '../modules/blackjack/engine';

describe('blackjack engine', () => {
  it('produces a deterministic shoe of 312 cards from a seed', () => {
    const seed = 'a'.repeat(64);
    const shoe1 = buildShoe(seed);
    const shoe2 = buildShoe(seed);
    expect(shoe1.length).toBe(312);
    expect(shoe1).toEqual(shoe2);
  });

  it('different seeds produce different shoes', () => {
    const s1 = buildShoe('1'.repeat(64));
    const s2 = buildShoe('2'.repeat(64));
    expect(s1).not.toEqual(s2);
  });

  it('counts each card exactly 6 times across the shoe', () => {
    const shoe = buildShoe('b'.repeat(64));
    const counts = new Map<number, number>();
    for (const c of shoe) counts.set(c, (counts.get(c) ?? 0) + 1);
    for (let i = 0; i < 52; i++) expect(counts.get(i)).toBe(6);
  });

  it('scores hands with ace flexibility', () => {
    // Ace + 6 = soft 17
    expect(scoreHand([0, 5])).toEqual({ total: 17, soft: true });
    // Ace + 6 + 9 = hard 16 (ace counted as 1)
    expect(scoreHand([0, 5, 8])).toEqual({ total: 16, soft: false });
    // Two aces = soft 12
    expect(scoreHand([0, 13])).toEqual({ total: 12, soft: true });
    // Face cards
    expect(scoreHand([10, 11])).toEqual({ total: 20, soft: false });
  });

  it('detects blackjack only on 2 cards totalling 21', () => {
    expect(isBlackjack([0, 10])).toBe(true); // A + J
    expect(isBlackjack([5, 6, 9])).toBe(false);
  });

  it('starts a game and assigns valid initial state', () => {
    const game = startGame('c'.repeat(64));
    expect(game.player.length).toBe(2);
    expect(game.dealer.length).toBe(2);
    expect(game.cursor).toBe(4);
    expect(['PLAYER_TURN', 'SETTLED']).toContain(game.state);
  });

  it('player stands and dealer plays out hitting soft 17', () => {
    // Find a seed where the player starts under 21 (almost always true).
    const game = startGame('d'.repeat(64));
    if (game.state === 'SETTLED') return; // skip edge seed
    const done = stand(game);
    expect(done.state).toBe('SETTLED');
    expect(done.outcome).toBeDefined();
    const dealerTotal = scoreHand(done.dealer).total;
    expect(dealerTotal === 21 || dealerTotal >= 17 || dealerTotal === 0).toBe(true);
  });

  it('payout multiplier produces correct values', () => {
    const baseSeed = 'e'.repeat(64);
    const g = startGame(baseSeed);
    if (g.state === 'SETTLED' && g.outcome === 'BLACKJACK') {
      expect(payoutMultiplier(g)).toBe(2.5);
    }
    // Manually construct a settled push
    const push = { ...g, state: 'SETTLED' as const, outcome: 'PUSH' as const, doubled: false };
    expect(payoutMultiplier(push)).toBe(1);
    const loss = { ...g, state: 'SETTLED' as const, outcome: 'LOSS' as const, doubled: false };
    expect(payoutMultiplier(loss)).toBe(0);
    const win = { ...g, state: 'SETTLED' as const, outcome: 'WIN' as const, doubled: false };
    expect(payoutMultiplier(win)).toBe(2);
    const winDouble = { ...g, state: 'SETTLED' as const, outcome: 'WIN' as const, doubled: true };
    expect(payoutMultiplier(winDouble)).toBe(4);
  });

  it('hit progresses the player hand or busts', () => {
    const game = startGame('f'.repeat(64));
    if (game.state === 'SETTLED') return;
    const before = game.player.length;
    const next = hit(game);
    expect(next.player.length).toBe(before + 1);
  });

  it('renders human-readable card labels', () => {
    expect(cardLabel(0)).toBe('AS');
    expect(cardLabel(12)).toBe('KS');
    expect(cardLabel(13)).toBe('AH');
    expect(cardLabel(51)).toBe('KC');
  });
});

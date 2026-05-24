import crypto from 'node:crypto';

/**
 * Deterministic, server-seeded blackjack engine.
 *
 * Cards are encoded as integers 0..51:
 *   suit = floor(card / 13)   -> 0..3
 *   rank = card % 13          -> 0 (Ace) .. 12 (King)
 *
 * The deck is produced from a SHA-256 keystream over a 32-byte server seed,
 * so a `(seed, cursor)` pair uniquely determines all subsequent draws — this
 * lets us persist a minimal game state and rebuild deterministically.
 *
 * The shoe uses 6 decks (standard blackjack) and is reshuffled per game.
 */
export const NUM_DECKS = 6;
export const CARDS_PER_DECK = 52;
export const SHOE_SIZE = NUM_DECKS * CARDS_PER_DECK;

export type Card = number;
export type Hand = Card[];

export type GameState =
  | 'PLAYER_TURN'
  | 'DEALER_TURN'
  | 'SETTLED';

export type Outcome =
  | 'WIN'
  | 'LOSS'
  | 'PUSH'
  | 'BLACKJACK'
  | 'BUST_PLAYER'
  | 'BUST_DEALER';

export interface BlackjackGame {
  seed: string;        // 32-byte hex server seed
  cursor: number;      // next-index into the shoe
  player: Hand;
  dealer: Hand;
  state: GameState;
  outcome?: Outcome;
  doubled: boolean;
}

export function newSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Public commitment for a server seed, used for provable-fair verification. */
export function hashSeedCommitment(seed: string): string {
  return crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
}

/**
 * Generate a Fisher-Yates shuffled shoe deterministically from `seed`.
 * Uses SHA-256(seed || counter) as a CSPRNG stream.
 */
export function buildShoe(seed: string): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (let c = 0; c < CARDS_PER_DECK; c++) shoe.push(c);
  }

  const seedBuf = Buffer.from(seed, 'hex');
  let counter = 0;
  let pool = Buffer.alloc(0);
  let poolOffset = 0;

  const nextU32 = (): number => {
    if (poolOffset + 4 > pool.length) {
      const ctrBuf = Buffer.alloc(8);
      ctrBuf.writeBigUInt64BE(BigInt(counter++));
      pool = crypto.createHash('sha256').update(seedBuf).update(ctrBuf).digest();
      poolOffset = 0;
    }
    const v = pool.readUInt32BE(poolOffset);
    poolOffset += 4;
    return v;
  };

  // Fisher-Yates from the end
  for (let i = shoe.length - 1; i > 0; i--) {
    const r = nextU32();
    const j = r % (i + 1);
    const tmp = shoe[i];
    shoe[i] = shoe[j];
    shoe[j] = tmp;
  }
  return shoe;
}

export function rankOf(card: Card): number {
  return card % 13;
}

export function cardLabel(card: Card): string {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['S', 'H', 'D', 'C'];
  return `${ranks[card % 13]}${suits[Math.floor(card / 13)]}`;
}

/**
 * Score a hand, returning the best (highest <= 21 if possible) total and a
 * "soft" flag indicating whether an Ace is currently counted as 11.
 */
export function scoreHand(hand: Hand): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    const r = rankOf(card);
    if (r === 0) {
      aces += 1;
      total += 11;
    } else if (r >= 10) {
      total += 10;
    } else {
      total += r + 1;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(hand: Hand): boolean {
  return hand.length === 2 && scoreHand(hand).total === 21;
}

function draw(game: BlackjackGame, shoe: Card[]): Card {
  if (game.cursor >= shoe.length) {
    throw new Error('Shoe exhausted');
  }
  const c = shoe[game.cursor];
  game.cursor += 1;
  return c;
}

export function startGame(seed: string): BlackjackGame {
  const shoe = buildShoe(seed);
  const game: BlackjackGame = {
    seed,
    cursor: 0,
    player: [],
    dealer: [],
    state: 'PLAYER_TURN',
    doubled: false,
  };
  // Standard dealing: P, D, P, D
  game.player.push(draw(game, shoe));
  game.dealer.push(draw(game, shoe));
  game.player.push(draw(game, shoe));
  game.dealer.push(draw(game, shoe));

  const playerBJ = isBlackjack(game.player);
  const dealerBJ = isBlackjack(game.dealer);
  if (playerBJ || dealerBJ) {
    game.state = 'SETTLED';
    if (playerBJ && dealerBJ) game.outcome = 'PUSH';
    else if (playerBJ) game.outcome = 'BLACKJACK';
    else game.outcome = 'LOSS';
  }
  return game;
}

export function hit(game: BlackjackGame): BlackjackGame {
  if (game.state !== 'PLAYER_TURN') throw new Error('Not player turn');
  const shoe = buildShoe(game.seed);
  game.player.push(draw(game, shoe));
  const { total } = scoreHand(game.player);
  if (total >= 21) {
    // Auto-stand on 21, bust on >21
    if (total > 21) {
      game.state = 'SETTLED';
      game.outcome = 'BUST_PLAYER';
    } else {
      return stand(game);
    }
  }
  return game;
}

export function doubleDown(game: BlackjackGame): BlackjackGame {
  if (game.state !== 'PLAYER_TURN') throw new Error('Not player turn');
  if (game.player.length !== 2) throw new Error('Double only on initial two cards');
  if (game.doubled) throw new Error('Already doubled');
  const shoe = buildShoe(game.seed);
  game.player.push(draw(game, shoe));
  game.doubled = true;
  const { total } = scoreHand(game.player);
  if (total > 21) {
    game.state = 'SETTLED';
    game.outcome = 'BUST_PLAYER';
    return game;
  }
  return stand(game);
}

export function stand(game: BlackjackGame): BlackjackGame {
  if (game.state !== 'PLAYER_TURN') throw new Error('Not player turn');
  game.state = 'DEALER_TURN';
  const shoe = buildShoe(game.seed);
  // Dealer hits soft 17
  while (true) {
    const { total, soft } = scoreHand(game.dealer);
    if (total < 17 || (total === 17 && soft)) {
      game.dealer.push(draw(game, shoe));
      continue;
    }
    break;
  }
  return resolve(game);
}

function resolve(game: BlackjackGame): BlackjackGame {
  const p = scoreHand(game.player).total;
  const d = scoreHand(game.dealer).total;
  if (p > 21) game.outcome = 'BUST_PLAYER';
  else if (d > 21) game.outcome = 'BUST_DEALER';
  else if (p > d) game.outcome = 'WIN';
  else if (p < d) game.outcome = 'LOSS';
  else game.outcome = 'PUSH';
  game.state = 'SETTLED';
  return game;
}

/**
 * Compute the payout multiplier (in units of the original USDC bet) that the
 * casino owes the player. Blackjack pays 3:2. A push refunds 1x. Loss/bust
 * yields 0. Double-down doubles the win/loss magnitude (the staked amount is
 * effectively 2x already, so multiplier vs. original bet is x2 / -2).
 */
export function payoutMultiplier(game: BlackjackGame): number {
  if (game.state !== 'SETTLED' || !game.outcome) return 0;
  const stake = game.doubled ? 2 : 1;
  switch (game.outcome) {
    case 'BLACKJACK':
      return 2.5; // bet returned + 1.5x profit
    case 'WIN':
    case 'BUST_DEALER':
      return 2 * stake; // bet returned + 1x profit
    case 'PUSH':
      return 1 * stake; // bet returned
    case 'LOSS':
    case 'BUST_PLAYER':
      return 0;
    default:
      return 0;
  }
}

/**
 * Maximum potential payout from a given bet (used by risk/max-bet sizing).
 * In blackjack the worst-case for the house is a natural blackjack (3:2),
 * which pays 2.5x. Double-down on a non-blackjack hand pays 2x of 2x = 4x
 * of the original bet, which is larger. We take the max of the two.
 */
export const MAX_PAYOUT_MULTIPLIER = 4;

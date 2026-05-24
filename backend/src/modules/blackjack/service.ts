import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { formatUnits, parseUnits } from '../../lib/token';
import { getConnection } from '../../lib/solana';
import { checkEligibility } from '../holders/holderService';
import { computeMaxBet } from '../risk/maxBet';
import { fetchCoinInfo } from '../coin/coinService';
import { invalidateBurnCache } from '../coin/burnService';
import {
  BlackjackGame,
  newSeed,
  hashSeedCommitment,
  startGame,
  hit,
  stand,
  doubleDown,
  scoreHand,
  payoutMultiplier,
  cardLabel,
} from './engine';
import {
  buildBetEscrowTx,
  burnLostStable,
  payoutUsdc,
} from '../settlement/settlementService';

export const startSchema = z.object({
  // Bet expressed in whole STABLECASINO tokens (decimal). Backend snapshots
  // the live Pump.fun USD price at start time to compute the locked USDC
  // value that the casino will pay out at the configured multiplier.
  betStable: z.coerce.number().positive(),
});

function serializeHand(hand: number[]) {
  return hand.map((c) => ({ raw: c, label: cardLabel(c) }));
}

function serializeGame(args: {
  gameRow: { id: string; state: string; outcome: string | null; betUsdc: string; doubledDown: boolean; payoutUsdc: string | null };
  game: BlackjackGame;
  hideDealerHole: boolean;
}) {
  const { gameRow, game, hideDealerHole } = args;
  const dealer = hideDealerHole && game.dealer.length > 1
    ? [game.dealer[0]]
    : game.dealer;
  return {
    id: gameRow.id,
    state: gameRow.state,
    outcome: gameRow.outcome,
    betUsdc: gameRow.betUsdc,
    doubled: gameRow.doubledDown,
    payoutUsdc: gameRow.payoutUsdc,
    player: {
      cards: serializeHand(game.player),
      total: scoreHand(game.player).total,
    },
    dealer: {
      cards: serializeHand(dealer),
      total: scoreHand(dealer).total,
      hiddenCount: hideDealerHole ? game.dealer.length - 1 : 0,
    },
    fairness: {
      seedCommitment: hashSeedCommitment(game.seed),
      // Seed remains hidden until the hand is over, then gets revealed so
      // anyone can deterministically replay and verify the full shoe.
      revealedSeed: gameRow.state === 'SETTLED' ? game.seed : null,
      deckCursor: game.cursor,
      algorithm: 'sha256-seeded-fisher-yates',
      numDecks: 6,
      dealerHitsSoft17: true,
      blackjackPayout: '3:2',
      doubleRule: 'first-two-cards',
      houseEdgeBps: env.HOUSE_EDGE_BPS,
    },
  };
}

function rehydrate(row: {
  deckSeed: string;
  deckCursor: number;
  playerHand: unknown;
  dealerHand: unknown;
  state: string;
  outcome: string | null;
  doubledDown: boolean;
}): BlackjackGame {
  return {
    seed: row.deckSeed,
    cursor: row.deckCursor,
    player: row.playerHand as number[],
    dealer: row.dealerHand as number[],
    state: row.state as BlackjackGame['state'],
    outcome: (row.outcome as BlackjackGame['outcome']) ?? undefined,
    doubled: row.doubledDown,
  };
}

export async function ensurePlayerEligible(wallet: string) {
  const eligibility = await checkEligibility(wallet);
  if (!eligibility.eligible) {
    throw new Error(
      `Wallet must hold at least ${eligibility.minBalance} STABLECASINO to play`,
    );
  }
  return eligibility;
}

export async function buildStartTx(args: {
  userId: string;
  wallet: string;
  betStable: number;
}) {
  const { userId, wallet, betStable } = args;

  await ensurePlayerEligible(wallet);
  const maxBet = await computeMaxBet();

  const coin = await fetchCoinInfo();
  const priceUsd = coin.priceUsdPerToken;
  if (!priceUsd || priceUsd <= 0) {
    throw new Error('Live $STABLECASINO price unavailable; cannot accept bets right now');
  }

  // Lock in the USD value of the bet at start time. Payouts use this snapshot
  // regardless of subsequent price movement, so the bankroll exposure is
  // deterministic for the lifetime of the hand.
  const betUsdcValue = betStable * priceUsd;
  const betUsdcStr = betUsdcValue.toFixed(env.USDC_MINT_DECIMALS);
  const betUsdcRaw = parseUnits(betUsdcStr, env.USDC_MINT_DECIMALS);

  const minBetRaw = BigInt(maxBet.minBetUsdcRaw);
  const maxBetRaw = BigInt(maxBet.maxBetUsdcRaw);

  const minStableLabel = maxBet.minBetStable ?? `${maxBet.minBetUsdc} USDC`;
  const maxStableLabel = maxBet.maxBetStable ?? `${maxBet.maxBetUsdc} USDC`;

  if (betUsdcRaw < minBetRaw) {
    throw new Error(
      `Minimum bet is ${minStableLabel} $STABLECASINO (~${maxBet.minBetUsdc} USDC)`,
    );
  }
  if (betUsdcRaw > maxBetRaw) {
    throw new Error(
      `Max bet is ${maxStableLabel} $STABLECASINO (~${maxBet.maxBetUsdc} USDC)`,
    );
  }

  // Stake actually transferred to the bankroll (in STABLECASINO base units).
  const stableAmountRaw = parseUnits(
    betStable.toFixed(env.STABLE_MINT_DECIMALS),
    env.STABLE_MINT_DECIMALS,
  );

  const seed = newSeed();
  const game = startGame(seed);

  const created = await prisma.game.create({
    data: {
      userId,
      betAmount: stableAmountRaw.toString(),
      betUsdc: betUsdcRaw.toString(),
      state: game.state,
      outcome: game.outcome ?? null,
      playerHand: game.player,
      dealerHand: game.dealer,
      deckSeed: game.seed,
      deckCursor: game.cursor,
    },
  });

  const escrow = await buildBetEscrowTx({ playerWallet: wallet, stableAmountRaw });

  await prisma.ledgerEntry.create({
    data: {
      kind: 'BET_IN',
      amount: stableAmountRaw.toString(),
      currency: 'STABLECASINO',
      reference: created.id,
    },
  });

  return {
    gameId: created.id,
    escrowTransaction: escrow.transaction,
    betStable: betStable.toString(),
    betUsdc: betUsdcStr,
    priceUsdPerStable: priceUsd,
    stableAmountRaw: stableAmountRaw.toString(),
    game: serializeGame({
      gameRow: {
        id: created.id,
        state: created.state,
        outcome: created.outcome,
        betUsdc: created.betUsdc,
        doubledDown: created.doubledDown,
        payoutUsdc: created.payoutUsdc,
      },
      game,
      hideDealerHole: created.state === 'PLAYER_TURN',
    }),
  };
}

export type BlackjackAction = 'hit' | 'stand' | 'double';

export async function confirmEscrow(args: {
  userId: string;
  gameId: string;
  signature: string;
}) {
  const { userId, gameId, signature } = args;
  const row = await prisma.game.findUnique({ where: { id: gameId } });
  if (!row || row.userId !== userId) throw new Error('Game not found');
  if (row.escrowConfirmed) return { confirmed: true, signature: row.escrowSig };

  const connection = getConnection();
  const status = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });
  const confirmation = status.value;
  if (!confirmation) throw new Error('Transaction not found on chain yet');
  if (confirmation.err) {
    throw new Error('Escrow transaction failed on chain');
  }
  if (
    confirmation.confirmationStatus !== 'confirmed' &&
    confirmation.confirmationStatus !== 'finalized'
  ) {
    throw new Error('Escrow transaction not yet confirmed');
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { escrowSig: signature, escrowConfirmed: true },
  });
  return { confirmed: true, signature };
}

export async function applyAction(args: {
  userId: string;
  gameId: string;
  action: BlackjackAction;
}) {
  const { userId, gameId, action } = args;
  const row = await prisma.game.findUnique({ where: { id: gameId } });
  if (!row || row.userId !== userId) throw new Error('Game not found');
  if (!row.escrowConfirmed) throw new Error('Escrow not confirmed');
  if (row.state !== 'PLAYER_TURN') throw new Error('Game not in player turn');

  let game = rehydrate(row);
  if (action === 'hit') game = hit(game);
  else if (action === 'stand') game = stand(game);
  else if (action === 'double') game = doubleDown(game);
  else throw new Error('Unknown action');

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      state: game.state,
      outcome: game.outcome ?? null,
      playerHand: game.player,
      dealerHand: game.dealer,
      deckCursor: game.cursor,
      doubledDown: game.doubled,
    },
  });

  return serializeGame({
    gameRow: {
      id: updated.id,
      state: updated.state,
      outcome: updated.outcome,
      betUsdc: updated.betUsdc,
      doubledDown: updated.doubledDown,
      payoutUsdc: updated.payoutUsdc,
    },
    game,
    hideDealerHole: updated.state === 'PLAYER_TURN',
  });
}

export async function settleGame(args: {
  userId: string;
  wallet: string;
  gameId: string;
}) {
  const { userId, wallet, gameId } = args;
  const row = await prisma.game.findUnique({ where: { id: gameId } });
  if (!row || row.userId !== userId) throw new Error('Game not found');
  if (!row.escrowConfirmed) throw new Error('Escrow not confirmed');
  if (row.state !== 'SETTLED') throw new Error('Game not finished');
  const stakeStableRaw = BigInt(row.betAmount) * BigInt(row.doubledDown ? 2 : 1);
  if (row.settled) {
    const burnedStableRaw = row.burnTx ? stakeStableRaw : 0n;
    return {
      alreadySettled: true,
      payoutUsdc: row.payoutUsdc,
      payoutTx: row.payoutTx,
      burnTx: row.burnTx,
      betStableRaw: stakeStableRaw.toString(),
      betStable: formatUnits(stakeStableRaw, env.STABLE_MINT_DECIMALS),
      burnedStableRaw: burnedStableRaw.toString(),
      burnedStable: formatUnits(burnedStableRaw, env.STABLE_MINT_DECIMALS),
    };
  }

  const game = rehydrate(row);
  const mult = payoutMultiplier(game);

  // Payout owed in USDC = bet * mult (mult==0 -> total loss).
  const betUsdcRaw = BigInt(row.betUsdc);

  // mult is a multiplier of *original* bet; encoded as a Number with up to 1
  // decimal place (2.5 max). Compute payout in raw USDC base units using
  // bigint arithmetic with a *10 factor to avoid float errors.
  const multX10 = BigInt(Math.round(mult * 10));
  const payoutUsdcRaw = (betUsdcRaw * multX10) / 10n;

  let payoutTx: string | null = null;
  let burnTx: string | null = null;

  if (payoutUsdcRaw > 0n) {
    payoutTx = await payoutUsdc({
      playerWallet: wallet,
      usdcAmountRaw: payoutUsdcRaw,
      reference: gameId,
    });
  }

  // Burn rules:
  // - Burn on all decisive outcomes (win or loss)
  // - Do NOT burn on push
  //
  // This means burns happen on:
  //   BLACKJACK, WIN, BUST_DEALER, LOSS, BUST_PLAYER
  // and not on:
  //   PUSH
  const shouldBurn = row.outcome !== 'PUSH';
  if (shouldBurn) {
    burnTx = await burnLostStable(stakeStableRaw, gameId);
    invalidateBurnCache();
  }

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      settled: true,
      payoutUsdc: payoutUsdcRaw.toString(),
      payoutTx,
      burnTx,
    },
  });

  return {
    alreadySettled: false,
    outcome: row.outcome,
    payoutUsdcRaw: payoutUsdcRaw.toString(),
    payoutUsdc: payoutUsdcRaw.toString(),
    payoutTx: updated.payoutTx,
    burnTx: updated.burnTx,
    betStableRaw: stakeStableRaw.toString(),
    betStable: formatUnits(stakeStableRaw, env.STABLE_MINT_DECIMALS),
    burnedStableRaw: shouldBurn ? stakeStableRaw.toString() : '0',
    burnedStable:
      shouldBurn
        ? formatUnits(stakeStableRaw, env.STABLE_MINT_DECIMALS)
        : formatUnits(0n, env.STABLE_MINT_DECIMALS),
  };
}

export async function getGameSnapshot(args: { userId: string; gameId: string }) {
  const { userId, gameId } = args;
  const row = await prisma.game.findUnique({ where: { id: gameId } });
  if (!row || row.userId !== userId) throw new Error('Game not found');
  const game = rehydrate(row);
  return serializeGame({
    gameRow: {
      id: row.id,
      state: row.state,
      outcome: row.outcome,
      betUsdc: row.betUsdc,
      doubledDown: row.doubledDown,
      payoutUsdc: row.payoutUsdc,
    },
    game,
    hideDealerHole: row.state === 'PLAYER_TURN',
  });
}

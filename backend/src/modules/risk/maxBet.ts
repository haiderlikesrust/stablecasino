import { Connection, PublicKey } from '@solana/web3.js';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import {
  getBankrollPublicKey,
  getConnection,
  getUsdcMint,
} from '../../lib/solana';
import { getTokenBalance, formatUnits, parseUnits } from '../../lib/token';
import { MAX_PAYOUT_MULTIPLIER } from '../blackjack/engine';
import { fetchCoinInfo } from '../coin/coinService';

export interface MaxBetInfo {
  bankrollUsdc: string;
  bankrollUsdcRaw: string;
  outstandingExposureRaw: string;
  availableUsdcRaw: string;
  maxBetUsdc: string;
  maxBetUsdcRaw: string;
  minBetUsdc: string;
  minBetUsdcRaw: string;
  // Native-token (STABLECASINO) denominated mirror of max/min.
  priceUsdPerStable: number | null;
  maxBetStable: string | null;
  minBetStable: string | null;
  fractionBps: number;
  ratioDivisor: number;
  floorUsdc: string;
  absoluteCapUsdc: string;
}

/** Sum the USDC currently at-risk across all unsettled games. */
async function getOutstandingExposureRaw(): Promise<bigint> {
  const live = await prisma.game.findMany({
    where: { settled: false },
    select: { betUsdc: true, doubledDown: true },
  });
  let exposure = 0n;
  for (const g of live) {
    const stake = BigInt(g.betUsdc);
    // Worst case the player doubles + naturals: cap at MAX_PAYOUT_MULTIPLIER
    exposure += stake * BigInt(MAX_PAYOUT_MULTIPLIER);
  }
  return exposure;
}

export async function computeMaxBet(
  connection: Connection = getConnection(),
  bankroll: PublicKey = getBankrollPublicKey(),
): Promise<MaxBetInfo> {
  const bankrollRaw = await getTokenBalance(connection, bankroll, getUsdcMint());
  const outstandingRaw = await getOutstandingExposureRaw();
  const availableRaw =
    bankrollRaw > outstandingRaw ? bankrollRaw - outstandingRaw : 0n;

  // Cap by fraction of bankroll (e.g. 2% per bet) and by absolute USDC cap.
  // The maximum a single bet can owe is MAX_PAYOUT_MULTIPLIER * bet.
  const fractionBps = BigInt(env.MAX_BET_BANKROLL_FRACTION_BPS);
  const exposureAllowedRaw = (availableRaw * fractionBps) / 10_000n;
  const maxBetByExposureRaw = exposureAllowedRaw / BigInt(MAX_PAYOUT_MULTIPLIER);

  const absoluteCapRaw = parseUnits(
    env.ABSOLUTE_MAX_BET_USDC.toString(),
    env.USDC_MINT_DECIMALS,
  );
  const maxBetRaw =
    maxBetByExposureRaw < absoluteCapRaw ? maxBetByExposureRaw : absoluteCapRaw;

  // Min bet is auto-derived as a fraction of the max bet, with an absolute
  // floor so we never quote sub-dust bets. Both inputs are env-driven.
  const floorRaw = parseUnits(
    env.MIN_BET_FLOOR_USDC.toString(),
    env.USDC_MINT_DECIMALS,
  );
  const minByRatioRaw = maxBetRaw / BigInt(env.MIN_BET_RATIO_DIVISOR);
  let minBetRaw = minByRatioRaw > floorRaw ? minByRatioRaw : floorRaw;
  // Don't let min exceed max (can happen when bankroll is near zero).
  if (minBetRaw > maxBetRaw) minBetRaw = maxBetRaw;

  // Derive the STABLECASINO-denominated bounds using the live Pump.fun price.
  // If the price feed is unavailable (e.g. token not yet launched) we leave
  // the stable amounts null and the UI falls back to USDC-only display.
  let priceUsdPerStable: number | null = null;
  let maxBetStable: string | null = null;
  let minBetStable: string | null = null;
  try {
    const coin = await fetchCoinInfo();
    if (coin.priceUsdPerToken && coin.priceUsdPerToken > 0) {
      priceUsdPerStable = coin.priceUsdPerToken;
      const maxUsdNum = Number(formatUnits(maxBetRaw, env.USDC_MINT_DECIMALS));
      const minUsdNum = Number(formatUnits(minBetRaw, env.USDC_MINT_DECIMALS));
      maxBetStable = (maxUsdNum / priceUsdPerStable).toFixed(
        env.STABLE_MINT_DECIMALS,
      );
      minBetStable = (minUsdNum / priceUsdPerStable).toFixed(
        env.STABLE_MINT_DECIMALS,
      );
    }
  } catch {
    // ignore — frontend will hide the native amounts until price is available
  }

  return {
    bankrollUsdc: formatUnits(bankrollRaw, env.USDC_MINT_DECIMALS),
    bankrollUsdcRaw: bankrollRaw.toString(),
    outstandingExposureRaw: outstandingRaw.toString(),
    availableUsdcRaw: availableRaw.toString(),
    maxBetUsdc: formatUnits(maxBetRaw, env.USDC_MINT_DECIMALS),
    maxBetUsdcRaw: maxBetRaw.toString(),
    minBetUsdc: formatUnits(minBetRaw, env.USDC_MINT_DECIMALS),
    minBetUsdcRaw: minBetRaw.toString(),
    priceUsdPerStable,
    maxBetStable,
    minBetStable,
    fractionBps: env.MAX_BET_BANKROLL_FRACTION_BPS,
    ratioDivisor: env.MIN_BET_RATIO_DIVISOR,
    floorUsdc: env.MIN_BET_FLOOR_USDC.toString(),
    absoluteCapUsdc: env.ABSOLUTE_MAX_BET_USDC.toString(),
  };
}

import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { formatUnits } from '../../lib/token';
import { fetchCoinInfo } from './coinService';

export interface BurnStats {
  totalBurnedRaw: string;
  totalBurned: string;
  totalBurnedUsdc: number | null;
  priceUsdPerStable: number | null;
  burnCount: number;
  lastBurnAt: number | null;
  recent: Array<{
    amount: string;
    amountRaw: string;
    txSignature: string | null;
    reference: string | null;
    createdAt: number;
  }>;
  fetchedAt: number;
}

interface CacheEntry {
  data: BurnStats;
  expiresAt: number;
}

let cached: CacheEntry | null = null;
const CACHE_TTL_MS = 10_000;

/**
 * Aggregate every $STABLECASINO burn the casino has executed. Sums the raw
 * base-unit amounts from `LedgerEntry` rows (kind=BURN, currency=STABLECASINO)
 * and converts to a whole-token total + USDC equivalent via the live
 * Pump.fun price. Cached for ~10s to keep load light.
 */
export async function getBurnStats(): Promise<BurnStats> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.data;

  const [allBurns, recentBurns] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { kind: 'BURN', currency: 'STABLECASINO' },
      select: { amount: true, createdAt: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { kind: 'BURN', currency: 'STABLECASINO' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { amount: true, txSignature: true, reference: true, createdAt: true },
    }),
  ]);

  let totalRaw = 0n;
  let lastBurnAt: number | null = null;
  for (const row of allBurns) {
    try {
      totalRaw += BigInt(row.amount);
    } catch {
      // skip malformed rows
    }
    const t = row.createdAt.getTime();
    if (lastBurnAt === null || t > lastBurnAt) lastBurnAt = t;
  }

  let priceUsdPerStable: number | null = null;
  try {
    const coin = await fetchCoinInfo();
    priceUsdPerStable = coin.priceUsdPerToken ?? null;
  } catch {
    priceUsdPerStable = null;
  }

  const totalBurned = formatUnits(totalRaw, env.STABLE_MINT_DECIMALS);
  const totalBurnedUsdc =
    priceUsdPerStable !== null
      ? Number(totalBurned) * priceUsdPerStable
      : null;

  const data: BurnStats = {
    totalBurnedRaw: totalRaw.toString(),
    totalBurned,
    totalBurnedUsdc,
    priceUsdPerStable,
    burnCount: allBurns.length,
    lastBurnAt,
    recent: recentBurns.map((r: (typeof recentBurns)[number]) => ({
      amount: formatUnits(BigInt(r.amount), env.STABLE_MINT_DECIMALS),
      amountRaw: r.amount,
      txSignature: r.txSignature,
      reference: r.reference,
      createdAt: r.createdAt.getTime(),
    })),
    fetchedAt: now,
  };

  cached = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

export function invalidateBurnCache() {
  cached = null;
}

import { prisma } from '../../lib/prisma';

export interface HolderSnapshotEntry {
  wallet: string;
  balanceRaw: string;
  share: number; // 0..1
  payoutLamports: string;
}

/**
 * Persist a planned airdrop distribution snapshot. This is the accounting
 * step; the actual on-chain transfer is performed off-band (e.g. by an
 * operator running a batched transfer script). We keep this off-chain in V1.
 */
export async function recordDistribution(args: {
  totalLamports: bigint;
  holders: HolderSnapshotEntry[];
  txSignature?: string;
}) {
  const { totalLamports, holders, txSignature } = args;
  return prisma.distributionRound.create({
    data: {
      totalLamports: totalLamports.toString(),
      holderSnapshot: holders as unknown as object,
      txSignature: txSignature ?? null,
    },
  });
}

/**
 * Given a list of (wallet, balanceRaw) tuples and a total lamports pool,
 * compute proportional payout amounts. Floor each entry to ensure the sum
 * never exceeds the pool.
 */
export function computeProportional(args: {
  totalLamports: bigint;
  holders: { wallet: string; balanceRaw: bigint }[];
}): HolderSnapshotEntry[] {
  const { totalLamports, holders } = args;
  const totalBalance = holders.reduce((acc, h) => acc + h.balanceRaw, 0n);
  if (totalBalance === 0n) return [];

  return holders.map((h) => {
    const payout = (totalLamports * h.balanceRaw) / totalBalance;
    return {
      wallet: h.wallet,
      balanceRaw: h.balanceRaw.toString(),
      share: Number((Number(h.balanceRaw) / Number(totalBalance)).toFixed(6)),
      payoutLamports: payout.toString(),
    };
  });
}

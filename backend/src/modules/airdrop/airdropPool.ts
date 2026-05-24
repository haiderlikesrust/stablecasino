import { prisma } from '../../lib/prisma';

/**
 * Net pending USDC airdrop pool, in base units (6 decimals).
 *
 *   pool = Σ(AIRDROP_ALLOC, USDC)  −  Σ(AIRDROP_OUT, USDC)
 *
 * Lives in its own file so both the airdrop executor and the top-holders
 * service can read it without creating an import cycle.
 */
export async function computePendingAirdropPoolUsdc(): Promise<bigint> {
  const [allocRows, outRows] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { kind: 'AIRDROP_ALLOC', currency: 'USDC' },
      select: { amount: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { kind: 'AIRDROP_OUT', currency: 'USDC' },
      select: { amount: true },
    }),
  ]);
  let alloc = 0n;
  for (const r of allocRows) {
    try {
      alloc += BigInt(r.amount);
    } catch {
      /* skip */
    }
  }
  let out = 0n;
  for (const r of outRows) {
    try {
      out += BigInt(r.amount);
    } catch {
      /* skip */
    }
  }
  const net = alloc - out;
  return net < 0n ? 0n : net;
}

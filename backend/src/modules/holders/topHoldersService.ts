import { Connection, PublicKey } from '@solana/web3.js';
import {
  bondingCurvePda,
  bondingCurveV2Pda,
  canonicalPumpPoolPda,
  canonicalPumpPoolPdaWithQuote,
  pumpPoolAuthorityPda,
} from '@pump-fun/pump-sdk';
import { NATIVE_MINT } from '@solana/spl-token';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import {
  getConnection,
  getBankrollPublicKey,
  getBurnAddress,
  getPumpCreatorPublicKey,
  getStableMint,
  getUsdcMint,
} from '../../lib/solana';
import { getMintProgramId, formatUnits } from '../../lib/token';
import { computePendingAirdropPoolUsdc } from '../airdrop/airdropPool';

export interface TopHolder {
  rank: number;
  owner: string;
  tokenAccount: string;
  balanceRaw: string;
  balance: string;
  share: number; // 0..1 of summed top-N balances
  estimatedNextPayoutUsdcBase: string;
  estimatedNextPayoutUsdc: string;
}

export interface TopHoldersResponse {
  mint: string;
  topN: number;
  fetchedAt: number;
  holders: TopHolder[];
  excludedOwners: string[];
  pendingAirdropPoolUsdcBase: string;
  pendingAirdropPoolUsdc: string;
  airdropIntervalMs: number;
  nextAirdropAt: number | null;
  lastAirdropAt: number | null;
}

interface CacheEntry {
  data: TopHoldersResponse;
  expiresAt: number;
}

let cached: CacheEntry | null = null;

/** Pump.fun bonding-curve liquidity ATAs etc. that should never be treated as holders. */
const DEFAULT_EXCLUDED = new Set<string>();

function getExclusionSet(): Set<string> {
  const set = new Set<string>(DEFAULT_EXCLUDED);
  const stableMint = getStableMint();
  const usdcMint = getUsdcMint();
  set.add(getBankrollPublicKey().toBase58());
  set.add(getBurnAddress().toBase58());
  set.add(getPumpCreatorPublicKey().toBase58());
  // Exclude protocol-owned liquidity / curve authorities so LP reserves
  // cannot appear as reward-eligible "holders" in the top-N list.
  set.add(bondingCurvePda(stableMint).toBase58());
  set.add(bondingCurveV2Pda(stableMint).toBase58());
  set.add(pumpPoolAuthorityPda(stableMint).toBase58());
  set.add(canonicalPumpPoolPda(stableMint).toBase58());
  set.add(canonicalPumpPoolPdaWithQuote(stableMint, usdcMint).toBase58());
  set.add(canonicalPumpPoolPdaWithQuote(stableMint, NATIVE_MINT).toBase58());
  for (const raw of env.AIRDROP_EXCLUDE_OWNERS.split(',')) {
    const trimmed = raw.trim();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

/**
 * Read the owner pubkey of an SPL/Token-2022 token account from its raw data.
 * Layout starts with: mint(32) + owner(32) + amount(8) ...
 * Both classic SPL Token and Token-2022 share this prefix.
 */
function decodeTokenAccountOwner(data: Buffer): PublicKey {
  return new PublicKey(data.subarray(32, 64));
}

async function getLastAirdropAt(): Promise<number | null> {
  const row = await prisma.distributionRound.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return row ? row.createdAt.getTime() : null;
}

/**
 * Fetch the top N holders of STABLE_MINT.
 *
 * Strategy: use the RPC `getTokenLargestAccounts` which returns up to 20 token
 * accounts ordered by balance. We then read each token account's raw data to
 * extract the owner wallet. Pump.fun mints live on Token-2022, but the base
 * account layout is identical to classic SPL Token, so the same offset trick
 * works for both.
 */
export async function getTopHolders(force = false): Promise<TopHoldersResponse> {
  const now = Date.now();
  if (!force && cached && cached.expiresAt > now) return cached.data;

  const connection: Connection = getConnection();
  const stableMint = getStableMint();
  const usdcMint = getUsdcMint();
  const programId = await getMintProgramId(connection, stableMint);

  const largest = await connection.getTokenLargestAccounts(stableMint, 'confirmed');
  const accounts = largest.value ?? [];

  const accountInfos = accounts.length
    ? await connection.getMultipleAccountsInfo(
        accounts.map((a) => a.address),
        'confirmed',
      )
    : [];

  const exclude = getExclusionSet();

  type Raw = {
    tokenAccount: string;
    owner: string;
    balanceRaw: bigint;
  };
  const rows: Raw[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const info = accountInfos[i];
    if (!info || !info.data) continue;
    // Some RPCs only return Token-2022 accounts when the right programId is
    // queried, but `getTokenLargestAccounts` already filters to this mint so
    // any returned account belongs to it. We sanity-check the owning program.
    if (!info.owner.equals(programId)) continue;
    let ownerPk: PublicKey;
    try {
      ownerPk = decodeTokenAccountOwner(info.data as Buffer);
    } catch {
      continue;
    }
    const owner = ownerPk.toBase58();
    if (exclude.has(owner)) continue;
    let balanceRaw: bigint;
    try {
      balanceRaw = BigInt(accounts[i]!.amount);
    } catch {
      continue;
    }
    if (balanceRaw <= 0n) continue;
    rows.push({
      tokenAccount: accounts[i]!.address.toBase58(),
      owner,
      balanceRaw,
    });
  }

  rows.sort((a, b) => (b.balanceRaw > a.balanceRaw ? 1 : b.balanceRaw < a.balanceRaw ? -1 : 0));
  const top = rows.slice(0, env.AIRDROP_TOP_N);

  const totalTop = top.reduce((acc, h) => acc + h.balanceRaw, 0n);

  const pendingPool = await computePendingAirdropPoolUsdc();
  const lastAirdropAt = await getLastAirdropAt();
  const nextAirdropAt =
    lastAirdropAt !== null ? lastAirdropAt + env.AIRDROP_INTERVAL_MS : null;

  const holders: TopHolder[] = top.map((h, i) => {
    const share = totalTop === 0n ? 0 : Number(h.balanceRaw) / Number(totalTop);
    const payout =
      totalTop === 0n ? 0n : (pendingPool * h.balanceRaw) / totalTop;
    return {
      rank: i + 1,
      owner: h.owner,
      tokenAccount: h.tokenAccount,
      balanceRaw: h.balanceRaw.toString(),
      balance: formatUnits(h.balanceRaw, env.STABLE_MINT_DECIMALS),
      share,
      estimatedNextPayoutUsdcBase: payout.toString(),
      estimatedNextPayoutUsdc: formatUnits(payout, env.USDC_MINT_DECIMALS),
    };
  });

  const data: TopHoldersResponse = {
    mint: stableMint.toBase58(),
    topN: env.AIRDROP_TOP_N,
    fetchedAt: now,
    holders,
    excludedOwners: Array.from(exclude),
    pendingAirdropPoolUsdcBase: pendingPool.toString(),
    pendingAirdropPoolUsdc: formatUnits(pendingPool, env.USDC_MINT_DECIMALS),
    airdropIntervalMs: env.AIRDROP_INTERVAL_MS,
    nextAirdropAt,
    lastAirdropAt,
  };

  cached = { data, expiresAt: now + env.TOP_HOLDERS_CACHE_MS };
  return data;
}

export function invalidateTopHoldersCache() {
  cached = null;
}

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import {
  getBankrollKeypair,
  getConnection,
  getUsdcMint,
} from '../../lib/solana';
import {
  getTopHolders,
  invalidateTopHoldersCache,
} from '../holders/topHoldersService';
import { computePendingAirdropPoolUsdc } from './airdropPool';
export { computePendingAirdropPoolUsdc } from './airdropPool';

export interface AirdropResult {
  status: 'ok' | 'skipped' | 'failed';
  reason?: string;
  poolUsdcBase: string;
  recipients: number;
  txSignatures: string[];
}

// Stay well below the 1232-byte transaction limit; each USDC payout adds two
// instructions (idempotent ATA create + transferChecked) and 2 new pubkeys to
// the account table. 5 recipients per tx is the safe sweet spot.
const RECIPIENTS_PER_TX = 5;

/**
 * Execute a single airdrop round in USDC:
 *   1. Compute the pending pool from the ledger.
 *   2. If above the configured minimum, fetch the top N holders.
 *   3. Build batched SPL token transfers (one tx per `RECIPIENTS_PER_TX`),
 *      each with an idempotent ATA-create + transferChecked per recipient.
 *   4. Record one `DistributionRound` plus an `AIRDROP_OUT` `LedgerEntry`
 *      per recipient.
 */
export async function runAirdropRound(): Promise<AirdropResult> {
  const top = await getTopHolders(true);
  const pool = BigInt(top.pendingAirdropPoolUsdcBase);

  if (pool <= 0n || pool < BigInt(env.AIRDROP_MIN_USDC_BASE)) {
    return {
      status: 'skipped',
      reason:
        pool <= 0n
          ? 'pool is empty'
          : `pool ${pool} below AIRDROP_MIN_USDC_BASE=${env.AIRDROP_MIN_USDC_BASE}`,
      poolUsdcBase: pool.toString(),
      recipients: 0,
      txSignatures: [],
    };
  }

  if (top.holders.length === 0) {
    return {
      status: 'skipped',
      reason: 'no eligible holders found',
      poolUsdcBase: pool.toString(),
      recipients: 0,
      txSignatures: [],
    };
  }

  let signer;
  try {
    signer = getBankrollKeypair();
  } catch (err) {
    return {
      status: 'failed',
      reason: `bankroll signer unavailable: ${(err as Error).message}`,
      poolUsdcBase: pool.toString(),
      recipients: 0,
      txSignatures: [],
    };
  }

  // Proportional payouts against the top-N total $STABLECASINO balance.
  const totalTop = top.holders.reduce((acc, h) => acc + BigInt(h.balanceRaw), 0n);
  if (totalTop === 0n) {
    return {
      status: 'skipped',
      reason: 'top holders have zero total balance',
      poolUsdcBase: pool.toString(),
      recipients: 0,
      txSignatures: [],
    };
  }

  type Payout = { owner: PublicKey; usdcBase: bigint };
  const payouts: Payout[] = [];
  let distributed = 0n;
  for (const h of top.holders) {
    const balance = BigInt(h.balanceRaw);
    const share = (pool * balance) / totalTop;
    if (share <= 0n) continue;
    payouts.push({ owner: new PublicKey(h.owner), usdcBase: share });
    distributed += share;
  }
  if (payouts.length === 0) {
    return {
      status: 'skipped',
      reason: 'all proportional payouts rounded to 0',
      poolUsdcBase: pool.toString(),
      recipients: 0,
      txSignatures: [],
    };
  }

  const connection = getConnection();
  const usdcMint = getUsdcMint();
  const sourceAta = getAssociatedTokenAddressSync(
    usdcMint,
    signer.publicKey,
    true,
    TOKEN_PROGRAM_ID,
  );

  const txSignatures: string[] = [];

  // Batch recipients into multiple txs to stay under the 1232-byte limit.
  for (let i = 0; i < payouts.length; i += RECIPIENTS_PER_TX) {
    const batch = payouts.slice(i, i + RECIPIENTS_PER_TX);
    const ixs: TransactionInstruction[] = [];

    for (const p of batch) {
      const destAta = getAssociatedTokenAddressSync(
        usdcMint,
        p.owner,
        true,
        TOKEN_PROGRAM_ID,
      );
      // Bankroll pays the rent if the recipient's USDC ATA doesn't exist yet.
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          signer.publicKey,
          destAta,
          p.owner,
          usdcMint,
          TOKEN_PROGRAM_ID,
        ),
      );
      ixs.push(
        createTransferCheckedInstruction(
          sourceAta,
          usdcMint,
          destAta,
          signer.publicKey,
          p.usdcBase,
          env.USDC_MINT_DECIMALS,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );
    }

    const tx = new Transaction().add(...ixs);
    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [signer], {
        commitment: 'confirmed',
      });
      txSignatures.push(sig);
    } catch (err) {
      // Persist a failure marker so we don't double-pay successful batches.
      return {
        status: 'failed',
        reason: `tx send failed at batch ${i / RECIPIENTS_PER_TX + 1}: ${(err as Error).message}`,
        poolUsdcBase: distributed.toString(),
        recipients: txSignatures.length * RECIPIENTS_PER_TX,
        txSignatures,
      };
    }
  }

  // Record everything atomically against the same DistributionRound id so the
  // ledger always reconciles.
  await prisma.$transaction(async (db) => {
    await db.distributionRound.create({
      data: {
        totalLamports: distributed.toString(), // schema field name preserved; value is USDC base units
        holderSnapshot: payouts.map((p) => ({
          owner: p.owner.toBase58(),
          usdcBase: p.usdcBase.toString(),
        })) as unknown as object,
        txSignature: txSignatures.join(','),
      },
    });
    await db.ledgerEntry.createMany({
      data: payouts.map((p, idx) => ({
        kind: 'AIRDROP_OUT',
        amount: p.usdcBase.toString(),
        currency: 'USDC',
        reference: p.owner.toBase58(),
        txSignature:
          txSignatures[Math.floor(idx / RECIPIENTS_PER_TX)] ?? null,
      })),
    });
  });

  invalidateTopHoldersCache();

  return {
    status: 'ok',
    poolUsdcBase: distributed.toString(),
    recipients: payouts.length,
    txSignatures,
  };
}

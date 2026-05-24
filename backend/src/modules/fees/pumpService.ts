import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { OnlinePumpSdk, creatorVaultPda } from '@pump-fun/pump-sdk';
import {
  coinCreatorVaultAtaPda,
  coinCreatorVaultAuthorityPda,
} from '@pump-fun/pump-swap-sdk';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import {
  getBankrollKeypair,
  getConnection,
  getPumpCreatorPublicKey,
  getUsdcMint,
} from '../../lib/solana';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { getRuntimeSettings } from '../admin/runtimeSettings';

let sdkSingleton: OnlinePumpSdk | null = null;
function getSdk(connection: Connection = getConnection()): OnlinePumpSdk {
  if (!sdkSingleton) sdkSingleton = new OnlinePumpSdk(connection);
  return sdkSingleton;
}

/**
 * Read the SOL bonding-curve creator vault balance (lamports, rent-adjusted).
 * Kept for diagnostics and future SOL flows — the schedulers key off USDC.
 */
export async function getPendingCreatorFeesLamports(
  creator: PublicKey = getPumpCreatorPublicKey(),
): Promise<bigint> {
  const sdk = getSdk();
  const balance = await sdk.getCreatorVaultBalance(creator);
  return BigInt(balance.toString());
}

/**
 * Read the balance of a single SPL token account, returning 0n if it doesn't
 * exist yet.
 */
async function safeReadAtaBalance(
  connection: Connection,
  ata: PublicKey,
): Promise<bigint> {
  try {
    const account = await getAccount(connection, ata, undefined, TOKEN_PROGRAM_ID);
    return account.amount;
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) return 0n;
    throw err;
  }
}

/**
 * Addresses of the two USDC creator-fee vaults for a given creator. Exposed
 * for diagnostics so we can log them at boot and have the operator verify
 * against a block explorer.
 */
export interface UsdcVaultAddresses {
  bondingCurveAuthority: string;
  bondingCurveUsdcAta: string;
  pumpSwapAuthority: string;
  pumpSwapUsdcAta: string;
}

export function getUsdcVaultAddresses(
  creator: PublicKey = getPumpCreatorPublicKey(),
): UsdcVaultAddresses {
  const usdcMint = getUsdcMint();
  const bondingAuthority = creatorVaultPda(creator);
  const bondingAta = getAssociatedTokenAddressSync(
    usdcMint,
    bondingAuthority,
    true,
    TOKEN_PROGRAM_ID,
  );
  const swapAuthority = coinCreatorVaultAuthorityPda(creator);
  const swapAta = coinCreatorVaultAtaPda(
    swapAuthority,
    usdcMint,
    TOKEN_PROGRAM_ID,
  );
  return {
    bondingCurveAuthority: bondingAuthority.toBase58(),
    bondingCurveUsdcAta: bondingAta.toBase58(),
    pumpSwapAuthority: swapAuthority.toBase58(),
    pumpSwapUsdcAta: swapAta.toBase58(),
  };
}

/**
 * Read the **total** USDC creator-fee balance across BOTH pools (bonding curve
 * + PumpSwap). USDC base units (6 decimals).
 *
 * Pump.fun's UI shows the combined number — we match that. The V2 collect
 * instruction we use sweeps both pools in one transaction, so this peek
 * matches what would actually be collected.
 */
export async function getPendingCreatorFeesUsdcBreakdown(
  creator: PublicKey = getPumpCreatorPublicKey(),
): Promise<{ bondingCurve: bigint; pumpSwap: bigint; total: bigint }> {
  const connection = getConnection();
  const usdcMint = getUsdcMint();
  const bondingAuthority = creatorVaultPda(creator);
  const bondingAta = getAssociatedTokenAddressSync(
    usdcMint,
    bondingAuthority,
    true,
    TOKEN_PROGRAM_ID,
  );
  const swapAuthority = coinCreatorVaultAuthorityPda(creator);
  const swapAta = coinCreatorVaultAtaPda(
    swapAuthority,
    usdcMint,
    TOKEN_PROGRAM_ID,
  );

  const [bondingCurve, pumpSwap] = await Promise.all([
    safeReadAtaBalance(connection, bondingAta),
    safeReadAtaBalance(connection, swapAta),
  ]);

  return {
    bondingCurve,
    pumpSwap,
    total: bondingCurve + pumpSwap,
  };
}

export async function getPendingCreatorFeesUsdc(
  creator: PublicKey = getPumpCreatorPublicKey(),
): Promise<bigint> {
  const breakdown = await getPendingCreatorFeesUsdcBreakdown(creator);
  return breakdown.total;
}

/**
 * Build, sign, and broadcast the on-chain `collectCreatorFeeV2` transaction
 * directly via `@pump-fun/pump-sdk`. The V2 instruction set takes the quote
 * mint as a parameter, so we pass USDC and pull creator rewards in USDC
 * from both the bonding curve and PumpSwap.
 *
 * We prepend an idempotent ATA-create for the creator's own USDC token
 * account so the first collect of a freshly-launched coin still succeeds.
 */
async function buildAndSendSdkCollectTx(
  connection: Connection,
  signerPublicKey: PublicKey,
): Promise<{ instructionsCount: number; signature: string }> {
  const sdk = getSdk(connection);
  const usdcMint = getUsdcMint();

  const creatorUsdcAta = getAssociatedTokenAddressSync(
    usdcMint,
    signerPublicKey,
    true,
    TOKEN_PROGRAM_ID,
  );

  const sdkIxs = await sdk.collectCoinCreatorFeeV2Instructions(
    signerPublicKey,
    usdcMint,
    TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction()
    .add(
      // Safe to include every time — no-op if the ATA already exists.
      createAssociatedTokenAccountIdempotentInstruction(
        signerPublicKey,
        creatorUsdcAta,
        signerPublicKey,
        usdcMint,
        TOKEN_PROGRAM_ID,
      ),
    )
    .add(...sdkIxs);

  const signer = getBankrollKeypair();
  const signature = await sendAndConfirmTransaction(connection, tx, [signer], {
    commitment: 'confirmed',
  });

  return { instructionsCount: 1 + sdkIxs.length, signature };
}

/**
 * Build (and optionally sign+send) the transaction that collects accumulated
 * Pump.fun creator fees in USDC. With `submit: true` we ask the SDK for the
 * `collectCreatorFeeV2` instructions, sign with the bankroll keypair (which
 * must be the creator), broadcast, confirm, and record a `FEE_IN` ledger
 * entry in USDC base units.
 */
export async function collectCreatorFees(
  options: { submit?: boolean } = {},
): Promise<{
  pendingUsdcBase: string;
  txSignature?: string;
  instructionsCount: number;
}> {
  const pending = await getPendingCreatorFeesUsdc();

  if (!options.submit) {
    return {
      pendingUsdcBase: pending.toString(),
      instructionsCount: 0,
    };
  }

  const signer = getBankrollKeypair();
  if (!signer.publicKey.equals(getPumpCreatorPublicKey())) {
    throw new Error(
      'Configured bankroll key does not match PUMP_CREATOR_PUBLIC_KEY; refusing to collect fees with the wrong signer.',
    );
  }

  const connection = getConnection();
  const { instructionsCount, signature } = await buildAndSendSdkCollectTx(
    connection,
    signer.publicKey,
  );

  await prisma.ledgerEntry.create({
    data: {
      kind: 'FEE_IN',
      amount: pending.toString(),
      currency: 'USDC',
      reference: 'pump_sdk_v2',
      txSignature: signature,
    },
  });

  return {
    pendingUsdcBase: pending.toString(),
    txSignature: signature,
    instructionsCount,
  };
}

/**
 * Snapshot current accumulated USDC creator fees and write a 50/50 allocation
 * record (50% airdrop pool, 50% bankroll). Accounting only — actual SOL/USDC
 * movement happens via `collectCreatorFees`.
 */
export async function snapshotFeesAndAllocate() {
  const pending = await getPendingCreatorFeesUsdc();
  const halfFloor = pending / 2n;
  const half2 = pending - halfFloor;

  const snap = await prisma.feeSnapshot.create({
    data: {
      pendingLamports: pending.toString(),
      collectedLamports: '0',
      bankrollAllocLamports: halfFloor.toString(),
      airdropAllocLamports: half2.toString(),
    },
  });

  await prisma.ledgerEntry.createMany({
    data: [
      {
        kind: 'BANKROLL_ALLOC',
        amount: halfFloor.toString(),
        currency: 'USDC',
        reference: snap.id,
      },
      {
        kind: 'AIRDROP_ALLOC',
        amount: half2.toString(),
        currency: 'USDC',
        reference: snap.id,
      },
    ],
  });

  return snap;
}

export const CREATOR_PUBLIC_KEY = getPumpCreatorPublicKey();
export const SOLANA_CLUSTER = getRuntimeSettings().SOLANA_CLUSTER;

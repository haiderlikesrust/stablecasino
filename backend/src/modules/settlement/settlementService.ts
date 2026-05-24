import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import {
  getBankrollKeypair,
  getBankrollPublicKey,
  getBurnAddress,
  getConnection,
  getStableMint,
  getUsdcMint,
} from '../../lib/solana';
import { getMintProgramId } from '../../lib/token';

/**
 * Build a transaction that the player signs to move their STABLECASINO bet
 * into the casino bankroll (the "house pot" for that hand). Returns the
 * base64-encoded serialized transaction for the frontend to deserialize and
 * sign with the connected wallet.
 *
 * The bet is escrowed in the bankroll wallet for the duration of the hand.
 */
export async function buildBetEscrowTx(args: {
  playerWallet: string;
  stableAmountRaw: bigint;
}) {
  const { playerWallet, stableAmountRaw } = args;
  const connection = getConnection();
  const stableMint = getStableMint();
  const bankrollPublicKey = getBankrollPublicKey();
  const player = new PublicKey(playerWallet);
  const programId = await getMintProgramId(connection, stableMint);

  const playerAta = await getAssociatedTokenAddress(
    stableMint,
    player,
    false,
    programId,
  );
  const bankrollAta = await getAssociatedTokenAddress(
    stableMint,
    bankrollPublicKey,
    false,
    programId,
  );

  const ixs: TransactionInstruction[] = [];

  // Make sure the bankroll's ATA exists (idempotent).
  try {
    await getAccount(connection, bankrollAta, undefined, programId);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          player, // payer
          bankrollAta,
          bankrollPublicKey,
          stableMint,
          programId,
        ),
      );
    } else {
      throw err;
    }
  }

  ixs.push(
    createTransferCheckedInstruction(
      playerAta,
      stableMint,
      bankrollAta,
      player,
      stableAmountRaw,
      env.STABLE_MINT_DECIMALS,
      [],
      programId,
    ),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: player,
    blockhash,
    lastValidBlockHeight,
  });
  tx.add(...ixs);

  const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
  return { transaction: serialized, blockhash, lastValidBlockHeight };
}

/**
 * Burn the STABLECASINO that the player lost by sending it from the bankroll
 * wallet to the configured burn sink (e.g. SPL incinerator). Returns the
 * settlement transaction signature.
 */
export async function burnLostStable(stableAmountRaw: bigint, reference: string) {
  if (stableAmountRaw <= 0n) return null;
  const connection = getConnection();
  const stableMint = getStableMint();
  const burnAddress = getBurnAddress();
  const bankroll = getBankrollKeypair();
  const programId = await getMintProgramId(connection, stableMint);

  const fromAta = await getAssociatedTokenAddress(
    stableMint,
    bankroll.publicKey,
    false,
    programId,
  );
  const toAta = await getAssociatedTokenAddress(
    stableMint,
    burnAddress,
    true,
    programId,
  );

  const ixs: TransactionInstruction[] = [];
  try {
    await getAccount(connection, toAta, undefined, programId);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          bankroll.publicKey,
          toAta,
          burnAddress,
          stableMint,
          programId,
        ),
      );
    } else {
      throw err;
    }
  }

  ixs.push(
    createTransferCheckedInstruction(
      fromAta,
      stableMint,
      toAta,
      bankroll.publicKey,
      stableAmountRaw,
      env.STABLE_MINT_DECIMALS,
      [],
      programId,
    ),
  );

  const tx = new Transaction().add(...ixs);
  const sig = await sendAndConfirmTransaction(connection, tx, [bankroll], {
    commitment: 'confirmed',
  });

  await prisma.ledgerEntry.create({
    data: {
      kind: 'BURN',
      amount: stableAmountRaw.toString(),
      currency: 'STABLECASINO',
      reference,
      txSignature: sig,
    },
  });
  return sig;
}

/**
 * Pay out USDC winnings from the casino bankroll to the player wallet.
 * The amount is in raw USDC base units (6 decimals by default).
 */
export async function payoutUsdc(args: {
  playerWallet: string;
  usdcAmountRaw: bigint;
  reference: string;
}) {
  const { playerWallet, usdcAmountRaw, reference } = args;
  if (usdcAmountRaw <= 0n) return null;
  const connection = getConnection();
  const usdcMint = getUsdcMint();
  const bankroll = getBankrollKeypair();
  const player = new PublicKey(playerWallet);
  const programId = await getMintProgramId(connection, usdcMint);

  const fromAta = await getAssociatedTokenAddress(
    usdcMint,
    bankroll.publicKey,
    false,
    programId,
  );
  const toAta = await getAssociatedTokenAddress(
    usdcMint,
    player,
    false,
    programId,
  );

  const ixs: TransactionInstruction[] = [];
  try {
    await getAccount(connection, toAta, undefined, programId);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) {
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          bankroll.publicKey,
          toAta,
          player,
          usdcMint,
          programId,
        ),
      );
    } else {
      throw err;
    }
  }

  ixs.push(
    createTransferCheckedInstruction(
      fromAta,
      usdcMint,
      toAta,
      bankroll.publicKey,
      usdcAmountRaw,
      env.USDC_MINT_DECIMALS,
      [],
      programId,
    ),
  );

  const tx = new Transaction().add(...ixs);
  const sig = await sendAndConfirmTransaction(connection, tx, [bankroll], {
    commitment: 'confirmed',
  });

  await prisma.ledgerEntry.create({
    data: {
      kind: 'PAYOUT_OUT',
      amount: usdcAmountRaw.toString(),
      currency: 'USDC',
      reference,
      txSignature: sig,
    },
  });
  return sig;
}

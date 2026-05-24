import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import {
  collectCreatorFees,
  getPendingCreatorFeesUsdcBreakdown,
  getUsdcVaultAddresses,
} from '../modules/fees/pumpService';
import { runAirdropRound } from '../modules/airdrop/airdropExecutor';
import { invalidateTopHoldersCache } from '../modules/holders/topHoldersService';
import { formatUnits } from '../lib/token';
import { getPumpCreatorPublicKey } from '../lib/solana';

const TAG_FEES = '[scheduler:fees]';
const TAG_AIR = '[scheduler:airdrop]';

let feeTimer: NodeJS.Timeout | null = null;
let airdropTimer: NodeJS.Timeout | null = null;
let feeRunning = false;
let airdropRunning = false;

function fmtUsdc(base: bigint): string {
  return formatUnits(base, env.USDC_MINT_DECIMALS);
}

/**
 * Try to collect Pump.fun creator fees (USDC). Logs a single line per tick.
 * On a successful submit we also write the 50/50 BANKROLL_ALLOC /
 * AIRDROP_ALLOC ledger entries so the airdrop round has a pool to draw from.
 */
async function feeTick() {
  if (feeRunning) return;
  feeRunning = true;
  const startedAt = new Date().toISOString();
  try {
    // Cheap pre-check so we don't broadcast a no-op tx every 10s when there
    // are no creator fees to collect. Read BOTH USDC vaults (bonding curve +
    // PumpSwap) and combine — Pump.fun's UI shows the combined number.
    const breakdown = await getPendingCreatorFeesUsdcBreakdown();
    const pendingPeek = breakdown.total;
    if (pendingPeek <= 0n) {
      console.log(
        `${TAG_FEES} ${startedAt} pending=0 USDC — nothing to collect ` +
          `(bonding=${fmtUsdc(breakdown.bondingCurve)}, swap=${fmtUsdc(breakdown.pumpSwap)})`,
      );
      return;
    }
    console.log(
      `${TAG_FEES} ${startedAt} peek: bonding=${fmtUsdc(breakdown.bondingCurve)} + swap=${fmtUsdc(breakdown.pumpSwap)} = ${fmtUsdc(pendingPeek)} USDC — collecting`,
    );

    const result = await collectCreatorFees({ submit: true });
    const pending = BigInt(result.pendingUsdcBase);
    if (pending <= 0n) {
      console.log(`${TAG_FEES} ${startedAt} pending raced to 0 between peek and collect`);
      return;
    }
    if (!result.txSignature) {
      console.log(
        `${TAG_FEES} ${startedAt} pending=${fmtUsdc(pending)} USDC, ixs=${result.instructionsCount}, no tx submitted`,
      );
      return;
    }

    // Record 50/50 USDC allocation against the collected amount.
    const half = pending / 2n;
    const remainder = pending - half;
    await prisma.ledgerEntry.createMany({
      data: [
        {
          kind: 'BANKROLL_ALLOC',
          amount: remainder.toString(),
          currency: 'USDC',
          reference: 'auto-collect',
          txSignature: result.txSignature,
        },
        {
          kind: 'AIRDROP_ALLOC',
          amount: half.toString(),
          currency: 'USDC',
          reference: 'auto-collect',
          txSignature: result.txSignature,
        },
      ],
    });
    invalidateTopHoldersCache();

    console.log(
      `${TAG_FEES} ${startedAt} collected ${fmtUsdc(pending)} USDC ` +
        `(bankroll=${fmtUsdc(remainder)}, airdrop=${fmtUsdc(half)}) tx=${result.txSignature}`,
    );
  } catch (err) {
    console.log(`${TAG_FEES} ${startedAt} failed: ${(err as Error).message}`);
  } finally {
    feeRunning = false;
  }
}

async function airdropTick() {
  if (airdropRunning) return;
  airdropRunning = true;
  const startedAt = new Date().toISOString();
  try {
    const r = await runAirdropRound();
    if (r.status === 'ok') {
      console.log(
        `${TAG_AIR} ${startedAt} distributed ${fmtUsdc(BigInt(r.poolUsdcBase))} USDC ` +
          `to ${r.recipients} holders across ${r.txSignatures.length} tx(s) ` +
          `[${r.txSignatures.join(', ')}]`,
      );
    } else if (r.status === 'skipped') {
      console.log(
        `${TAG_AIR} ${startedAt} skipped (${r.reason}); pool=${fmtUsdc(BigInt(r.poolUsdcBase))} USDC`,
      );
    } else {
      console.log(
        `${TAG_AIR} ${startedAt} failed (${r.reason}); pool=${fmtUsdc(BigInt(r.poolUsdcBase))} USDC`,
      );
    }
  } catch (err) {
    console.log(`${TAG_AIR} ${startedAt} threw: ${(err as Error).message}`);
  } finally {
    airdropRunning = false;
  }
}

export function startSchedulers() {
  if (env.AUTO_COLLECT_FEES) {
    // Log the addresses we will be polling so the operator can sanity-check
    // them against a block explorer (or pump.fun itself).
    try {
      const creator = getPumpCreatorPublicKey();
      const addrs = getUsdcVaultAddresses(creator);
      console.log(
        `${TAG_FEES} creator=${creator.toBase58()}\n` +
          `${TAG_FEES}   bonding-curve USDC ATA: ${addrs.bondingCurveUsdcAta} (owner ${addrs.bondingCurveAuthority})\n` +
          `${TAG_FEES}   pump-swap     USDC ATA: ${addrs.pumpSwapUsdcAta} (owner ${addrs.pumpSwapAuthority})`,
      );
    } catch (err) {
      console.log(`${TAG_FEES} could not derive vault addresses: ${(err as Error).message}`);
    }
    console.log(
      `${TAG_FEES} starting auto-collect every ${env.FEE_COLLECT_INTERVAL_MS}ms (USDC)`,
    );
    feeTick();
    feeTimer = setInterval(feeTick, env.FEE_COLLECT_INTERVAL_MS);
    if (feeTimer.unref) feeTimer.unref();
  } else {
    console.log(`${TAG_FEES} AUTO_COLLECT_FEES=false — fee scheduler disabled`);
  }

  if (env.AUTO_AIRDROP) {
    console.log(
      `${TAG_AIR} starting auto-airdrop every ${env.AIRDROP_INTERVAL_MS}ms (top ${env.AIRDROP_TOP_N}, USDC)`,
    );
    airdropTimer = setInterval(airdropTick, env.AIRDROP_INTERVAL_MS);
    if (airdropTimer.unref) airdropTimer.unref();
  } else {
    console.log(`${TAG_AIR} AUTO_AIRDROP=false — airdrop scheduler disabled`);
  }
}

export function stopSchedulers() {
  if (feeTimer) clearInterval(feeTimer);
  if (airdropTimer) clearInterval(airdropTimer);
  feeTimer = null;
  airdropTimer = null;
}

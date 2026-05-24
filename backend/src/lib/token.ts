import { Connection, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TokenAccountNotFoundError,
} from '@solana/spl-token';

const programIdCache = new Map<string, PublicKey>();

/**
 * Determine whether a mint is owned by the standard SPL Token program or the
 * newer Token-2022 program. Result is cached per-mint for the process lifetime.
 *
 * Pump.fun tokens typically live on Token-2022, while USDC stays on the
 * classic SPL Token program — so every transfer / ATA derivation must look
 * up the owning program rather than assuming a default.
 */
export async function getMintProgramId(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  const key = mint.toBase58();
  const cached = programIdCache.get(key);
  if (cached) return cached;

  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`Mint account ${key} not found`);

  let programId: PublicKey;
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) programId = TOKEN_2022_PROGRAM_ID;
  else if (info.owner.equals(TOKEN_PROGRAM_ID)) programId = TOKEN_PROGRAM_ID;
  else
    throw new Error(
      `Mint ${key} is not owned by a recognised token program (got ${info.owner.toBase58()})`,
    );

  programIdCache.set(key, programId);
  return programId;
}

/**
 * Read a wallet's SPL token balance for a given mint. Returns the raw base-unit
 * amount as a bigint (0n if the ATA does not exist).
 */
export async function getTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<bigint> {
  const programId = await getMintProgramId(connection, mint);
  const ata = await getAssociatedTokenAddress(mint, owner, true, programId);
  try {
    const account = await getAccount(connection, ata, undefined, programId);
    return account.amount;
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) return 0n;
    throw err;
  }
}

/** Convert a base-unit bigint into a human-readable decimal string. */
export function formatUnits(amount: bigint, decimals: number): string {
  const isNeg = amount < 0n;
  const abs = isNeg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  if (frac === 0n) return `${isNeg ? '-' : ''}${whole.toString()}`;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${isNeg ? '-' : ''}${whole.toString()}.${fracStr}`;
}

/** Convert a decimal string into a base-unit bigint with rounding-down. */
export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid numeric string: ${value}`);
  }
  const isNeg = trimmed.startsWith('-');
  const unsigned = isNeg ? trimmed.slice(1) : trimmed;
  const [whole, frac = ''] = unsigned.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const result = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
  return isNeg ? -result : result;
}

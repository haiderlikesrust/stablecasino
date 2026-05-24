import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { getRuntimeSettings } from '../modules/admin/runtimeSettings';

let connectionSingleton: Connection | null = null;
let connectionRpcUrl: string | null = null;

export function getConnection(): Connection {
  const settings = getRuntimeSettings();
  if (!connectionSingleton || connectionRpcUrl !== settings.SOLANA_RPC_URL) {
    connectionRpcUrl = settings.SOLANA_RPC_URL;
    connectionSingleton = new Connection(connectionRpcUrl, 'confirmed');
  }
  return connectionSingleton;
}

export function getStableMint(): PublicKey {
  return new PublicKey(getRuntimeSettings().STABLE_MINT);
}

export function getUsdcMint(): PublicKey {
  return new PublicKey(getRuntimeSettings().USDC_MINT);
}

export function getBurnAddress(): PublicKey {
  return new PublicKey(getRuntimeSettings().BURN_ADDRESS);
}

export function getBankrollPublicKey(): PublicKey {
  return new PublicKey(getRuntimeSettings().CASINO_BANKROLL_PUBLIC_KEY);
}

export function getPumpCreatorPublicKey(): PublicKey {
  return new PublicKey(getRuntimeSettings().PUMP_CREATOR_PUBLIC_KEY);
}

/**
 * Lazily decode the bankroll keypair. Throws if the configured secret is a
 * placeholder so that signing operations fail fast in non-production envs.
 */
export function getBankrollKeypair(): Keypair {
  const secret = getRuntimeSettings().CASINO_BANKROLL_PRIVATE_KEY;
  if (!secret || secret.startsWith('replace-')) {
    throw new Error(
      'CASINO_BANKROLL_PRIVATE_KEY is not configured. Set it before invoking signing operations.',
    );
  }
  try {
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(decoded);
  } catch (err) {
    throw new Error(`Failed to decode CASINO_BANKROLL_PRIVATE_KEY: ${(err as Error).message}`);
  }
}

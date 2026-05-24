import { PublicKey } from '@solana/web3.js';
import { env } from '../../config/env';
import { getConnection, getStableMint, getUsdcMint } from '../../lib/solana';
import { getTokenBalance, formatUnits, parseUnits } from '../../lib/token';

export interface EligibilityResult {
  wallet: string;
  stableBalance: string;
  stableBalanceRaw: string;
  usdcBalance: string;
  usdcBalanceRaw: string;
  minBalance: string;
  eligible: boolean;
}

/**
 * Determine whether `wallet` holds enough STABLECASINO to access the play page.
 * The threshold is `HOLDER_MIN_BALANCE` (in whole tokens) from env.
 */
export async function checkEligibility(wallet: string): Promise<EligibilityResult> {
  const connection = getConnection();
  const owner = new PublicKey(wallet);

  const [stableRaw, usdcRaw] = await Promise.all([
    getTokenBalance(connection, owner, getStableMint()),
    getTokenBalance(connection, owner, getUsdcMint()),
  ]);

  const minBalanceRaw = parseUnits(env.HOLDER_MIN_BALANCE.toString(), env.STABLE_MINT_DECIMALS);

  return {
    wallet,
    stableBalance: formatUnits(stableRaw, env.STABLE_MINT_DECIMALS),
    stableBalanceRaw: stableRaw.toString(),
    usdcBalance: formatUnits(usdcRaw, env.USDC_MINT_DECIMALS),
    usdcBalanceRaw: usdcRaw.toString(),
    minBalance: env.HOLDER_MIN_BALANCE.toString(),
    eligible: stableRaw >= minBalanceRaw,
  };
}

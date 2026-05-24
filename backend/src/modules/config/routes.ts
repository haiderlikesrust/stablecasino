import { Router } from 'express';
import { env } from '../../config/env';
import { getRuntimeSettings } from '../admin/runtimeSettings';

const router = Router();

/**
 * Public runtime config consumed by the frontend at boot. Lets the operator
 * configure RPC/mint addresses in one place (backend `.env`) and have the
 * browser pick them up automatically.
 *
 * Note: anything returned here is visible to the browser. Don't leak secrets.
 * Helius keys should be domain-locked in the Helius dashboard before exposing.
 */
router.get('/', (_req, res) => {
  const settings = getRuntimeSettings();
  res.json({
    cluster: settings.SOLANA_CLUSTER,
    solanaRpcUrl: settings.SOLANA_RPC_URL,
    stableMint: settings.STABLE_MINT,
    usdcMint: settings.USDC_MINT,
    stableMintDecimals: env.STABLE_MINT_DECIMALS,
    usdcMintDecimals: env.USDC_MINT_DECIMALS,
  });
});

export default router;

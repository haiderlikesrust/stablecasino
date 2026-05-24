import { Router } from 'express';
import {
  getPendingCreatorFeesLamports,
  getPendingCreatorFeesUsdcBreakdown,
  getUsdcVaultAddresses,
  collectCreatorFees,
  snapshotFeesAndAllocate,
} from './pumpService';
import { env } from '../../config/env';
import { getPumpCreatorPublicKey } from '../../lib/solana';
import { getRuntimeSettings } from '../admin/runtimeSettings';

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    const creator = getPumpCreatorPublicKey();
    const settings = getRuntimeSettings();
    const [pendingLamports, breakdown] = await Promise.all([
      getPendingCreatorFeesLamports(),
      getPendingCreatorFeesUsdcBreakdown(),
    ]);
    const fmt = (b: bigint) =>
      (Number(b) / 10 ** env.USDC_MINT_DECIMALS).toFixed(env.USDC_MINT_DECIMALS);
    res.json({
      cluster: settings.SOLANA_CLUSTER,
      creator: creator.toBase58(),
      vaults: getUsdcVaultAddresses(creator),
      pendingLamports: pendingLamports.toString(),
      pendingSol: (Number(pendingLamports) / 1e9).toString(),
      pendingUsdc: {
        bondingCurveBase: breakdown.bondingCurve.toString(),
        pumpSwapBase: breakdown.pumpSwap.toString(),
        totalBase: breakdown.total.toString(),
        bondingCurve: fmt(breakdown.bondingCurve),
        pumpSwap: fmt(breakdown.pumpSwap),
        total: fmt(breakdown.total),
      },
      bankrollSharePct: 50,
      airdropSharePct: 50,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Admin-only in real deployments — gate this behind auth before exposing. */
router.post('/collect', async (req, res) => {
  try {
    const submit = Boolean(req.body?.submit);
    const result = await collectCreatorFees({ submit });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/snapshot', async (_req, res) => {
  try {
    const snap = await snapshotFeesAndAllocate();
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

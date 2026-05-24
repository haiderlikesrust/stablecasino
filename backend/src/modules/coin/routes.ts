import { Router } from 'express';
import { fetchCoinInfo, invalidateCoinCache } from './coinService';
import { getBurnStats, invalidateBurnCache } from './burnService';
import { env } from '../../config/env';
import { getRuntimeSettings } from '../admin/runtimeSettings';

const router = Router();

router.get('/info', async (req, res) => {
  const mintParam =
    typeof req.query.mint === 'string' ? req.query.mint : getRuntimeSettings().STABLE_MINT;
  const force = req.query.force === '1' || req.query.force === 'true';
  try {
    const info = await fetchCoinInfo(mintParam, { force });
    res.set('Cache-Control', `public, max-age=${Math.floor(env.COIN_INFO_CACHE_MS / 1000)}`);
    res.json(info);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get('/burn-stats', async (_req, res) => {
  try {
    const stats = await getBurnStats();
    res.set('Cache-Control', 'public, max-age=10');
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/refresh', (_req, res) => {
  invalidateCoinCache();
  invalidateBurnCache();
  res.json({ ok: true });
});

export default router;

import { Router } from 'express';
import { getTopHolders, invalidateTopHoldersCache } from './topHoldersService';

const router = Router();

router.get('/top', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  try {
    const data = await getTopHolders(force);
    res.set('Cache-Control', 'public, max-age=15');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.post('/top/refresh', (_req, res) => {
  invalidateTopHoldersCache();
  res.json({ ok: true });
});

export default router;

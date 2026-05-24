import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, requireAuth } from '../../middleware/auth';
import { computeMaxBet } from '../risk/maxBet';
import {
  startSchema,
  buildStartTx,
  applyAction,
  settleGame,
  getGameSnapshot,
  confirmEscrow,
} from './service';

const router = Router();

router.get('/max-bet', requireAuth, async (_req, res) => {
  try {
    const info = await computeMaxBet();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/start', requireAuth, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid bet' });
  const { sub, wallet } = (req as AuthedRequest).session;
  try {
    const result = await buildStartTx({
      userId: sub,
      wallet,
      betStable: parsed.data.betStable,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

const confirmSchema = z.object({
  gameId: z.string().min(1),
  signature: z.string().min(16),
});
router.post('/confirm', requireAuth, async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { sub } = (req as AuthedRequest).session;
  try {
    const result = await confirmEscrow({
      userId: sub,
      gameId: parsed.data.gameId,
      signature: parsed.data.signature,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

const actionSchema = z.object({
  gameId: z.string().min(1),
  action: z.enum(['hit', 'stand', 'double']),
});
router.post('/action', requireAuth, async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid action' });
  const { sub } = (req as AuthedRequest).session;
  try {
    const result = await applyAction({
      userId: sub,
      gameId: parsed.data.gameId,
      action: parsed.data.action,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

const settleSchema = z.object({ gameId: z.string().min(1) });
router.post('/settle', requireAuth, async (req, res) => {
  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const { sub, wallet } = (req as AuthedRequest).session;
  try {
    const result = await settleGame({
      userId: sub,
      wallet,
      gameId: parsed.data.gameId,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/game/:id', requireAuth, async (req, res) => {
  const { sub } = (req as AuthedRequest).session;
  const id = String(req.params.id ?? '');
  try {
    const snap = await getGameSnapshot({ userId: sub, gameId: id });
    res.json(snap);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

export default router;

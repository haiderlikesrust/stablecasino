import { Router } from 'express';
import { z } from 'zod';
import { createNonce, verifySignature } from './authService';

const router = Router();

const nonceSchema = z.object({ wallet: z.string().min(32).max(64) });
router.post('/nonce', async (req, res) => {
  const parsed = nonceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid wallet' });
  try {
    const result = await createNonce(parsed.data.wallet);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

const verifySchema = z.object({
  wallet: z.string().min(32).max(64),
  nonce: z.string().min(8),
  signature: z.string().min(16),
});
router.post('/verify', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const result = await verifySignature(parsed.data);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

export default router;

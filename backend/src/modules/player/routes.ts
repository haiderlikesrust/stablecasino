import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../../middleware/auth';
import { checkEligibility } from '../holders/holderService';

const router = Router();

router.get('/eligibility', requireAuth, async (req, res) => {
  const { wallet } = (req as AuthedRequest).session;
  try {
    const result = await checkEligibility(wallet);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/balances', requireAuth, async (req, res) => {
  const { wallet } = (req as AuthedRequest).session;
  try {
    const result = await checkEligibility(wallet);
    res.json({
      wallet,
      stable: { amount: result.stableBalance, raw: result.stableBalanceRaw },
      usdc: { amount: result.usdcBalance, raw: result.usdcBalanceRaw },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

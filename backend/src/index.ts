import './lib/silenceNoise';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import authRoutes from './modules/auth/routes';
import playerRoutes from './modules/player/routes';
import blackjackRoutes from './modules/blackjack/routes';
import feesRoutes from './modules/fees/routes';
import coinRoutes from './modules/coin/routes';
import configRoutes from './modules/config/routes';
import holdersRoutes from './modules/holders/routes';
import adminRoutes from './modules/admin/routes';
import { startSchedulers } from './scheduler';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, cluster: env.SOLANA_CLUSTER });
  });

  app.use('/auth', authRoutes);
  app.use('/player', playerRoutes);
  app.use('/blackjack', blackjackRoutes);
  app.use('/fees', feesRoutes);
  app.use('/coin', coinRoutes);
  app.use('/config', configRoutes);
  app.use('/holders', holdersRoutes);
  app.use('/admin', adminRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[stablecasino] listening on http://localhost:${env.PORT}`);
    // Background schedulers only run for the live server, never for tests.
    if (env.NODE_ENV !== 'test') startSchedulers();
  });
}

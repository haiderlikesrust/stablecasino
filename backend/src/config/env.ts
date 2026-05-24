import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  ADMIN_PANEL_PASSWORD: z.string().min(8).default('change-this-admin-password'),

  DATABASE_URL: z.string().url(),

  SOLANA_RPC_URL: z.string().url(),
  SOLANA_CLUSTER: z.string().default('mainnet-beta'),

  STABLE_MINT: z.string().min(32),
  USDC_MINT: z.string().min(32),
  STABLE_MINT_DECIMALS: z.coerce.number().int().min(0).max(18).default(6),
  USDC_MINT_DECIMALS: z.coerce.number().int().min(0).max(18).default(6),

  CASINO_BANKROLL_PUBLIC_KEY: z.string().min(32),
  CASINO_BANKROLL_PRIVATE_KEY: z.string().min(1),

  BURN_ADDRESS: z.string().min(32),

  PUMP_CREATOR_PUBLIC_KEY: z.string().min(32),

  HOLDER_MIN_BALANCE: z.coerce.number().nonnegative().default(1),
  HOUSE_EDGE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
  MAX_BET_BANKROLL_FRACTION_BPS: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(200),
  MIN_BET_RATIO_DIVISOR: z.coerce.number().int().min(1).max(10_000).default(100),
  MIN_BET_FLOOR_USDC: z.coerce.number().nonnegative().default(0.1),
  ABSOLUTE_MAX_BET_USDC: z.coerce.number().nonnegative().default(500),

  PUMP_FRONTEND_API_URL: z
    .string()
    .url()
    .default('https://frontend-api-v3.pump.fun'),
  COIN_INFO_CACHE_MS: z.coerce.number().int().nonnegative().default(15_000),

  AUTO_COLLECT_FEES: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((v) => v === 'true'),
  FEE_COLLECT_INTERVAL_MS: z.coerce.number().int().min(1_000).default(10_000),
  AUTO_AIRDROP: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((v) => v === 'true'),
  AIRDROP_INTERVAL_MS: z.coerce.number().int().min(10_000).default(30 * 60_000),
  AIRDROP_TOP_N: z.coerce.number().int().min(1).max(50).default(20),
  // Min pending USDC pool (in base units, 6 decimals) before an airdrop round
  // will fire. Default 0 = always pay whatever is there.
  AIRDROP_MIN_USDC_BASE: z.coerce.number().int().nonnegative().default(0),
  AIRDROP_EXCLUDE_OWNERS: z.string().default(''),
  TOP_HOLDERS_CACHE_MS: z.coerce.number().int().nonnegative().default(30_000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

export const env = parsed.data;
export type Env = typeof env;

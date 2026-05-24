import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { env } from '../../config/env';

export const runtimeSettingKeys = [
  'SOLANA_CLUSTER',
  'SOLANA_RPC_URL',
  'STABLE_MINT',
  'USDC_MINT',
  'CASINO_BANKROLL_PUBLIC_KEY',
  'CASINO_BANKROLL_PRIVATE_KEY',
  'BURN_ADDRESS',
  'PUMP_CREATOR_PUBLIC_KEY',
  'PUMP_FRONTEND_API_URL',
] as const;

export type RuntimeSettingKey = (typeof runtimeSettingKeys)[number];

export type RuntimeSettings = Record<RuntimeSettingKey, string>;

const SETTINGS_FILE = path.resolve(process.cwd(), 'data', 'runtime-settings.json');

const defaults: RuntimeSettings = {
  SOLANA_CLUSTER: env.SOLANA_CLUSTER,
  SOLANA_RPC_URL: env.SOLANA_RPC_URL,
  STABLE_MINT: env.STABLE_MINT,
  USDC_MINT: env.USDC_MINT,
  CASINO_BANKROLL_PUBLIC_KEY: env.CASINO_BANKROLL_PUBLIC_KEY,
  CASINO_BANKROLL_PRIVATE_KEY: env.CASINO_BANKROLL_PRIVATE_KEY,
  BURN_ADDRESS: env.BURN_ADDRESS,
  PUMP_CREATOR_PUBLIC_KEY: env.PUMP_CREATOR_PUBLIC_KEY,
  PUMP_FRONTEND_API_URL: env.PUMP_FRONTEND_API_URL,
};

let cachedSettings: RuntimeSettings | null = null;

function sanitize(raw: unknown): RuntimeSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return runtimeSettingKeys.reduce((acc, key) => {
    const value = src[key];
    acc[key] =
      typeof value === 'string' && value.trim().length > 0 ? value.trim() : defaults[key];
    return acc;
  }, {} as RuntimeSettings);
}

function persist(settings: RuntimeSettings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SETTINGS_FILE, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

export function getRuntimeSettings(): RuntimeSettings {
  if (cachedSettings) return cachedSettings;
  if (!existsSync(SETTINGS_FILE)) {
    cachedSettings = { ...defaults };
    persist(cachedSettings);
    return cachedSettings;
  }
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as unknown;
    cachedSettings = sanitize(parsed);
  } catch {
    cachedSettings = { ...defaults };
  }
  return cachedSettings;
}

export function updateRuntimeSettings(
  patch: Partial<Record<RuntimeSettingKey, string>>,
): RuntimeSettings {
  const current = getRuntimeSettings();
  const merged = sanitize({ ...current, ...patch });
  cachedSettings = merged;
  persist(merged);
  return merged;
}

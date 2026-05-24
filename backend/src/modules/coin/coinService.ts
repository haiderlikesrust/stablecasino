import { env } from '../../config/env';
import { getRuntimeSettings } from '../admin/runtimeSettings';

/**
 * Subset of the Pump.fun frontend-api-v3 response we care about.
 * The full response has many more fields; we deliberately re-emit a stable
 * surface so frontend code isn't coupled to upstream churn.
 */
export interface PumpCoinRaw {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri?: string;
  metadata_uri?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  bonding_curve?: string;
  associated_bonding_curve?: string;
  creator?: string;
  created_timestamp?: number;
  complete?: boolean;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
  total_supply?: number;
  total_supply_str?: string;
  real_sol_reserves?: number;
  real_token_reserves?: number;
  market_cap?: number;
  usd_market_cap?: number;
  ath_market_cap?: number;
  ath_market_cap_timestamp?: number;
  last_trade_timestamp?: number;
  reply_count?: number;
  is_currently_live?: boolean;
  nsfw?: boolean;
  is_banned?: boolean;
  program?: string;
  protocol?: string;
  token_program?: string;
  updated_at?: number;
}

export interface CoinInfo {
  mint: string;
  name: string;
  symbol: string;
  description: string | null;
  imageUri: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  creator: string | null;
  createdAt: number | null;
  bondingCurve: string | null;
  complete: boolean;
  // Live pricing
  marketCapSol: number | null;
  marketCapUsd: number | null;
  athMarketCapUsd: number | null;
  athMarketCapAt: number | null;
  priceSolPerToken: number | null;
  priceUsdPerToken: number | null;
  // Reserves
  virtualSolReserves: string | null;
  virtualTokenReserves: string | null;
  realSolReserves: string | null;
  realTokenReserves: string | null;
  totalSupply: string | null;
  // Activity
  lastTradeAt: number | null;
  replyCount: number | null;
  isCurrentlyLive: boolean;
  updatedAt: number | null;
  // Meta
  source: 'pump.fun';
  fetchedAt: number;
}

interface CacheEntry {
  data: CoinInfo;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Solana SOL has 9 decimals (1 SOL = 1e9 lamports).
const LAMPORTS_PER_SOL = 1_000_000_000;

function normalize(raw: PumpCoinRaw, tokenDecimals: number): CoinInfo {
  // Pump.fun returns supply and virtual token reserves in *base units*
  // (raw integer count, NOT whole tokens). To get a price per *whole* token
  // we divide by 10^decimals first. Without this, a 6-decimals supply of 1e15
  // would look like 1 quadrillion tokens and the price would be ~$1e-12.
  const tokenScale = 10 ** tokenDecimals;

  const vSolLamports = raw.virtual_sol_reserves;
  const vTokRaw = raw.virtual_token_reserves;
  const priceSolPerToken =
    typeof vSolLamports === 'number' &&
    typeof vTokRaw === 'number' &&
    vTokRaw > 0
      ? vSolLamports / LAMPORTS_PER_SOL / (vTokRaw / tokenScale)
      : null;

  let priceUsdPerToken: number | null = null;
  if (typeof raw.usd_market_cap === 'number') {
    const supplyStr = raw.total_supply_str ?? raw.total_supply?.toString();
    if (supplyStr) {
      const supplyRaw = Number(supplyStr);
      if (Number.isFinite(supplyRaw) && supplyRaw > 0) {
        const wholeSupply = supplyRaw / tokenScale;
        priceUsdPerToken = raw.usd_market_cap / wholeSupply;
      }
    }
  }

  const supplyRaw = raw.total_supply_str ?? raw.total_supply?.toString() ?? null;
  const totalSupplyWhole =
    supplyRaw && Number.isFinite(Number(supplyRaw))
      ? (Number(supplyRaw) / tokenScale).toString()
      : null;

  return {
    mint: raw.mint,
    name: raw.name,
    symbol: raw.symbol,
    description: raw.description ?? null,
    imageUri: raw.image_uri ?? null,
    website: raw.website ?? null,
    twitter: raw.twitter ?? null,
    telegram: raw.telegram ?? null,
    creator: raw.creator ?? null,
    createdAt: raw.created_timestamp ?? null,
    bondingCurve: raw.bonding_curve ?? null,
    complete: Boolean(raw.complete),
    marketCapSol: typeof raw.market_cap === 'number' ? raw.market_cap : null,
    marketCapUsd: typeof raw.usd_market_cap === 'number' ? raw.usd_market_cap : null,
    athMarketCapUsd:
      typeof raw.ath_market_cap === 'number' ? raw.ath_market_cap : null,
    athMarketCapAt: raw.ath_market_cap_timestamp ?? null,
    priceSolPerToken,
    priceUsdPerToken,
    virtualSolReserves:
      typeof raw.virtual_sol_reserves === 'number'
        ? raw.virtual_sol_reserves.toString()
        : null,
    virtualTokenReserves:
      typeof raw.virtual_token_reserves === 'number'
        ? raw.virtual_token_reserves.toString()
        : null,
    realSolReserves:
      typeof raw.real_sol_reserves === 'number'
        ? raw.real_sol_reserves.toString()
        : null,
    realTokenReserves:
      typeof raw.real_token_reserves === 'number'
        ? raw.real_token_reserves.toString()
        : null,
    // Expose whole-token supply (not base units) so the UI reads "1,000,000,000"
    // for a typical pump.fun coin instead of "1,000,000,000,000,000".
    totalSupply: totalSupplyWhole,
    lastTradeAt: raw.last_trade_timestamp ?? null,
    replyCount: typeof raw.reply_count === 'number' ? raw.reply_count : null,
    isCurrentlyLive: Boolean(raw.is_currently_live),
    updatedAt: raw.updated_at ?? null,
    source: 'pump.fun',
    fetchedAt: Date.now(),
  };
}

export async function fetchCoinInfo(
  mint: string = getRuntimeSettings().STABLE_MINT,
  options: { force?: boolean; decimals?: number } = {},
): Promise<CoinInfo> {
  const decimals = options.decimals ?? env.STABLE_MINT_DECIMALS;
  const now = Date.now();
  const cached = cache.get(mint);
  if (!options.force && cached && cached.expiresAt > now) {
    return cached.data;
  }

  const url = `${getRuntimeSettings().PUMP_FRONTEND_API_URL.replace(/\/$/, '')}/coins/${mint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Serve stale on upstream errors so the UI keeps working.
    if (cached) return cached.data;
    throw new Error(`Pump.fun coin lookup failed: HTTP ${res.status}`);
  }

  const raw = (await res.json()) as PumpCoinRaw;
  if (!raw?.mint) {
    if (cached) return cached.data;
    throw new Error('Pump.fun coin lookup returned an unexpected payload');
  }

  const data = normalize(raw, decimals);
  cache.set(mint, {
    data,
    expiresAt: now + env.COIN_INFO_CACHE_MS,
  });
  return data;
}

export function invalidateCoinCache(mint?: string) {
  if (mint) cache.delete(mint);
  else cache.clear();
}

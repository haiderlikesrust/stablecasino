export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      (typeof body === 'object' && body && 'error' in body
        ? (body as { error: string }).error
        : null) ?? `Request failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface VerifyResponse {
  token: string;
  expiresAt: string;
  user: { id: string; wallet: string };
}

export interface EligibilityResponse {
  wallet: string;
  stableBalance: string;
  usdcBalance: string;
  minBalance: string;
  eligible: boolean;
}

export interface MaxBetResponse {
  bankrollUsdc: string;
  outstandingExposureRaw: string;
  availableUsdcRaw: string;
  maxBetUsdc: string;
  minBetUsdc: string;
  priceUsdPerStable: number | null;
  maxBetStable: string | null;
  minBetStable: string | null;
  fractionBps: number;
  ratioDivisor: number;
  floorUsdc: string;
  absoluteCapUsdc: string;
}

export interface CardInfo { raw: number; label: string; }
export interface GameSnapshot {
  id: string;
  state: 'PLAYER_TURN' | 'DEALER_TURN' | 'SETTLED';
  outcome: string | null;
  betUsdc: string;
  doubled: boolean;
  payoutUsdc: string | null;
  player: { cards: CardInfo[]; total: number };
  dealer: { cards: CardInfo[]; total: number; hiddenCount: number };
  fairness: {
    seedCommitment: string;
    revealedSeed: string | null;
    deckCursor: number;
    algorithm: string;
    numDecks: number;
    dealerHitsSoft17: boolean;
    blackjackPayout: string;
    doubleRule: string;
    houseEdgeBps: number;
  };
}

export interface StartGameResponse {
  gameId: string;
  escrowTransaction: string; // base64 serialized tx
  betStable: string;
  betUsdc: string;
  priceUsdPerStable: number;
  stableAmountRaw: string;
  game: GameSnapshot;
}

export interface SettleResponse {
  alreadySettled: boolean;
  outcome?: string;
  payoutUsdcRaw?: string;
  payoutUsdc?: string;
  payoutTx?: string | null;
  burnTx?: string | null;
  betStableRaw?: string;
  betStable?: string;
  burnedStableRaw?: string;
  burnedStable?: string;
}

export interface FeeStatus {
  cluster: string;
  pendingLamports: string;
  pendingSol: string;
  bankrollSharePct: number;
  airdropSharePct: number;
}

export interface TopHolder {
  rank: number;
  owner: string;
  tokenAccount: string;
  balanceRaw: string;
  balance: string;
  share: number;
  estimatedNextPayoutUsdcBase: string;
  estimatedNextPayoutUsdc: string;
}

export interface TopHoldersResponse {
  mint: string;
  topN: number;
  fetchedAt: number;
  holders: TopHolder[];
  excludedOwners: string[];
  pendingAirdropPoolUsdcBase: string;
  pendingAirdropPoolUsdc: string;
  airdropIntervalMs: number;
  nextAirdropAt: number | null;
  lastAirdropAt: number | null;
}

export interface BurnStats {
  totalBurnedRaw: string;
  totalBurned: string;
  totalBurnedUsdc: number | null;
  priceUsdPerStable: number | null;
  burnCount: number;
  lastBurnAt: number | null;
  recent: Array<{
    amount: string;
    amountRaw: string;
    txSignature: string | null;
    reference: string | null;
    createdAt: number;
  }>;
  fetchedAt: number;
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
  marketCapSol: number | null;
  marketCapUsd: number | null;
  athMarketCapUsd: number | null;
  athMarketCapAt: number | null;
  priceSolPerToken: number | null;
  priceUsdPerToken: number | null;
  virtualSolReserves: string | null;
  virtualTokenReserves: string | null;
  realSolReserves: string | null;
  realTokenReserves: string | null;
  totalSupply: string | null;
  lastTradeAt: number | null;
  replyCount: number | null;
  isCurrentlyLive: boolean;
  updatedAt: number | null;
  source: 'pump.fun';
  fetchedAt: number;
}

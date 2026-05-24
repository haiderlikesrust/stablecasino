# StableCasino API

Base URL: `http://localhost:4000` (configurable via `PORT`).

All authenticated endpoints accept a `Authorization: Bearer <jwt>` header obtained from `/auth/verify`.

## Health

### `GET /health`
Returns `{ ok: true, cluster: "mainnet-beta" }`.

## Auth

### `POST /auth/nonce`
Request: `{ wallet: string }` (base58 Solana public key)

Response:
```json
{
  "nonce": "hex",
  "message": "Sign in to StableCasino\n\nWallet: <wallet>\nNonce: <nonce>",
  "expiresAt": "ISO-8601"
}
```

### `POST /auth/verify`
Request: `{ wallet: string, nonce: string, signature: string }` (signature is base58 of the Ed25519 signature over the `message` from the nonce step).

Response: `{ token, expiresAt, user: { id, wallet } }`.

## Player

### `GET /player/eligibility` *(auth)*
Returns whether the wallet holds enough $STABLECASINO to play. Threshold is `HOLDER_MIN_BALANCE` (env).

### `GET /player/balances` *(auth)*
Returns $STABLECASINO and USDC balances for the authenticated wallet.

## Blackjack

### `GET /blackjack/max-bet` *(auth)*
Returns the current min/max bet sizing based on bankroll and outstanding exposure.

### `POST /blackjack/start` *(auth)*
Request: `{ betUsdc: number }`.

Response:
```json
{
  "gameId": "...",
  "escrowTransaction": "base64",
  "betUsdc": "10",
  "stableAmountRaw": "10000000",
  "game": { /* GameSnapshot */ }
}
```

The frontend must deserialize `escrowTransaction`, sign it with the connected wallet, and submit it before any actions are accepted.

### `POST /blackjack/confirm` *(auth)*
Request: `{ gameId: string, signature: string }` (signature returned by the wallet send).

Backend verifies the tx is `confirmed`/`finalized` on chain. Returns `{ confirmed: true, signature }`.

### `POST /blackjack/action` *(auth)*
Request: `{ gameId: string, action: "hit"|"stand"|"double" }`. Returns the updated `GameSnapshot`.

### `POST /blackjack/settle` *(auth)*
Request: `{ gameId: string }`.

For wins it pays USDC to the player; for losses it burns the escrowed $STABLECASINO. Idempotent.

### `GET /blackjack/game/:id` *(auth)*
Returns the current `GameSnapshot` for inspection.

## Coin info (Pump.fun proxy)

### `GET /coin/info?mint=<optional>&force=<0|1>`
Public read-only. Defaults to the `STABLE_MINT` env. Backend proxies and caches the Pump.fun `frontend-api-v3` response for `COIN_INFO_CACHE_MS` (default 15s) and returns a normalized shape:

```json
{
  "mint": "...",
  "name": "...",
  "symbol": "...",
  "imageUri": "https://...",
  "marketCapUsd": 12345.67,
  "marketCapSol": 12.34,
  "athMarketCapUsd": 22502.5,
  "priceUsdPerToken": 0.0000236,
  "priceSolPerToken": 2.82e-8,
  "totalSupply": "1000000000000000",
  "complete": false,
  "isCurrentlyLive": false,
  "lastTradeAt": 1777335080000,
  "source": "pump.fun",
  "fetchedAt": 1777335082000
}
```

If Pump.fun is unreachable and a cached entry exists, the cached value is served as a fallback.

### `GET /coin/burn-stats`
Public read-only. Aggregates every recorded `BURN` ledger entry for `$STABLECASINO` and returns the cumulative burned supply plus a live USDC valuation. Cached for ~10s server-side; invalidated automatically after each successful settlement burn.

```json
{
  "totalBurnedRaw": "1234567890000",
  "totalBurned": "1234567.89",
  "totalBurnedUsdc": 42.5,
  "priceUsdPerStable": 0.0000345,
  "burnCount": 47,
  "lastBurnAt": 1716552000000,
  "recent": [
    {
      "amount": "12345.67",
      "amountRaw": "12345670000",
      "txSignature": "5h7...",
      "reference": "<gameId>",
      "createdAt": 1716552000000
    }
  ],
  "fetchedAt": 1716552010000
}
```

### `POST /coin/refresh`
Operator hook to evict the in-process coin info **and** burn-stats caches.

## Fees (Pump.fun)

### `GET /fees/status`
Public read-only.
```json
{
  "cluster": "mainnet-beta",
  "pendingLamports": "...",
  "pendingSol": "...",
  "bankrollSharePct": 50,
  "airdropSharePct": 50
}
```

### `POST /fees/collect` *(operator)*
Request: `{ submit?: boolean }`. With `submit: true` the backend calls `OnlinePumpSdk.collectCoinCreatorFeeV2Instructions(creator, USDC_MINT, TOKEN_PROGRAM_ID)`, prepends an idempotent ATA-create for the creator's USDC token account, signs the assembled `Transaction` with the bankroll keypair (which must be the creator), broadcasts it, and confirms before recording a `FEE_IN currency: 'USDC'` ledger entry with `reference: 'pump_sdk_v2'`. With `submit: false` it just returns the current pending USDC base units.

### `POST /fees/snapshot` *(operator)*
Writes a fee snapshot and allocates 50/50 between bankroll and airdrop pools.

## Holders

### `GET /holders/top`
Public read-only. Returns the top `AIRDROP_TOP_N` (default 20) `$STABLECASINO` holders ranked by balance, plus the pending airdrop pool (allocated minus distributed). The bankroll, burn address, Pump.fun creator and `AIRDROP_EXCLUDE_OWNERS` are excluded. Cached for `TOP_HOLDERS_CACHE_MS` (default 30s) and busted automatically after each fee collection / airdrop round.

```json
{
  "mint": "...",
  "topN": 20,
  "fetchedAt": 1716552010000,
  "holders": [
    {
      "rank": 1,
      "owner": "<wallet>",
      "tokenAccount": "<ata>",
      "balanceRaw": "1000000000000",
      "balance": "1000000",
      "share": 0.32,
      "estimatedNextPayoutLamports": "12345678",
      "estimatedNextPayoutSol": 0.01234
    }
  ],
  "excludedOwners": ["<bankroll>", "<burn>", "<pumpCreator>"],
  "pendingAirdropPoolLamports": "...",
  "pendingAirdropPoolSol": 0.05,
  "airdropIntervalMs": 1800000,
  "nextAirdropAt": 1716553800000,
  "lastAirdropAt": 1716552000000
}
```

### `POST /holders/top/refresh`
Operator hook to evict the in-process top-holders cache.

## Schedulers

These run inside the live Express process (skipped for `NODE_ENV=test`).

* **Fee collector** — every `FEE_COLLECT_INTERVAL_MS` (default 10s). First peeks `getPendingCreatorFeesUsdc` (cheap RPC read of the PumpSwap USDC creator-vault ATA) and skips immediately when there is nothing to collect. When pending > 0 it calls `collectCreatorFees({ submit: true })` which uses `OnlinePumpSdk.collectCoinCreatorFeeV2Instructions` to build the on-chain `collectCreatorFeeV2` transaction in USDC, signs and broadcasts it via the bankroll keypair. Pending fees are collected to the bankroll wallet's USDC ATA and a 50/50 `BANKROLL_ALLOC` + `AIRDROP_ALLOC` ledger entry (`currency: 'USDC'`) is recorded against the collected base units. Each tick logs one line, e.g.:
  ```
  [scheduler:fees] 2026-05-24T13:34:00.000Z collected 0.001234 SOL (bankroll=0.000617, airdrop=0.000617) tx=5h7...
  [scheduler:fees] 2026-05-24T13:34:10.000Z pending=0 — nothing to collect
  ```
* **Airdrop distributor** — every `AIRDROP_INTERVAL_MS` (default 30 min). Computes the pending pool (allocated − distributed) and, if above `AIRDROP_MIN_LAMPORTS`, sends a single batched `SystemProgram.transfer` transaction from the bankroll to the top `AIRDROP_TOP_N` holders proportional to their share of the top-N total balance. Writes a `DistributionRound` plus one `AIRDROP_OUT` ledger entry per recipient.

Both can be disabled with `AUTO_COLLECT_FEES=false` / `AUTO_AIRDROP=false`.

## GameSnapshot shape

```ts
{
  id: string;
  state: "PLAYER_TURN" | "DEALER_TURN" | "SETTLED";
  outcome: null | "WIN" | "LOSS" | "PUSH" | "BLACKJACK" | "BUST_PLAYER" | "BUST_DEALER";
  betUsdc: string;            // base units
  doubled: boolean;
  payoutUsdc: string | null;  // base units, set after /settle
  player: { cards: { raw: number; label: string }[]; total: number };
  dealer: { cards: { raw: number; label: string }[]; total: number; hiddenCount: number };
}
```

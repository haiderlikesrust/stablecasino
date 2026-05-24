# StableCasino Architecture

## Components

- **Frontend** (`frontend/`) — Next.js 15 App Router, Tailwind, Solana wallet adapter. Handles wallet connection, message signing for auth, and the blackjack UI. Talks to the backend over HTTPS.
- **Backend** (`backend/`) — Express + TypeScript + Prisma + PostgreSQL. Owns the blackjack engine, holder eligibility checks, max-bet sizing, escrow + settlement transactions, and Pump.fun creator-fee integration.

```
[Wallet] <-> [Frontend Next.js] <-> [Backend Express]
                                          |\
                                          | \--> [PostgreSQL]
                                          |
                                          +--> [Solana mainnet RPC]
                                          +--> [Pump SDK]
                                          +--> [Casino bankroll keypair]
```

## Money flow

```
Pump.fun trades on $STABLECASINO
        │
        ▼
Creator fees (lamports)  ──> Pump SDK getCreatorVaultBalanceBothPrograms()
        │
        ├── 50% → Casino bankroll (USDC)        (covers blackjack payouts)
        └── 50% → Airdrop pool       (USDC)     (distributed to holders proportional to $STABLECASINO holdings)

Holder gets airdropped USDC
        │
        ├── Holds → waits for next airdrop
        └── Plays → Swap USDC -> $STABLECASINO -> Blackjack
                       │
                       ▼
                Bet placed in $STABLECASINO
                       │
                ┌──────┴──────┐
                ▼             ▼
            Loss           Win
        Burn stake   Pay player in USDC from bankroll
```

## Auth flow

1. Frontend calls `POST /auth/nonce { wallet }` to receive `nonce` + `message`.
2. Wallet signs the message via `signMessage`.
3. Frontend calls `POST /auth/verify { wallet, nonce, signature }`. Backend verifies the Ed25519 signature, marks the nonce used, creates a `Session`, and returns a JWT.
4. Subsequent requests pass `Authorization: Bearer <jwt>`.

## Blackjack engine

- 6-deck shoe (312 cards).
- Shuffle is deterministic from a 32-byte server seed: shoe is Fisher-Yates shuffled using a SHA-256 keystream `SHA256(seed || counter)`.
- State is persisted as `(seed, cursor, playerHand, dealerHand, doubled)` so every game can be replayed for audit.
- Dealer hits on soft 17. Blackjack pays 3:2. Double allowed on initial two cards only.

## Bet -> settlement flow

1. `POST /blackjack/start` validates holder eligibility, computes `maxBet`, creates a `Game`, returns an *unsigned* escrow transaction (serialized base64).
2. Frontend deserializes, asks the wallet to sign, and broadcasts it. The escrow tx transfers $STABLECASINO from the player to the casino bankroll ATA.
3. Frontend calls `POST /blackjack/confirm` with the signature. Backend verifies the tx is `confirmed`/`finalized` on chain and marks `escrowConfirmed=true`.
4. Player issues `POST /blackjack/action { gameId, action }` (`hit | stand | double`). Backend rehydrates the game from `(seed, cursor)` and mutates state.
5. When the hand is `SETTLED`, frontend calls `POST /blackjack/settle`:
   - Loss → `burnLostStable` sends the escrowed $STABLECASINO from bankroll to the configured burn address.
   - Win / blackjack / push → `payoutUsdc` transfers the owed USDC from bankroll to the player.

## Max-bet sizing

The `risk/maxBet.ts` calculator returns a per-bet cap derived from:

```
exposureAllowedRaw = bankrollUsdc * (MAX_BET_BANKROLL_FRACTION_BPS / 10_000)
maxBetByExposure   = exposureAllowedRaw / MAX_PAYOUT_MULTIPLIER   // 4x worst case
maxBet             = min(maxBetByExposure, ABSOLUTE_MAX_BET_USDC)
```

Available bankroll is reduced by the sum of unsettled bets' worst-case payouts so the bank can always cover concurrent games.

## Pump SDK integration

- `getPendingCreatorFeesLamports()` calls `sdk.getCreatorVaultBalanceBothPrograms(creator)`.
- `collectCreatorFees({ submit })` uses `sdk.collectCoinCreatorFeeInstructions(creator)`. With `submit: true`, the backend signs and broadcasts (requires the bankroll key to *be* the creator key, or to have authority).
- `snapshotFeesAndAllocate()` records a 50/50 allocation snapshot used by the off-band distribution job.

## Tables

- `User` — wallet identity.
- `Nonce` — single-use auth challenge.
- `Session` — JWT bookkeeping.
- `Game` — every hand; persisted seed makes audits possible.
- `LedgerEntry` — every BET_IN / PAYOUT_OUT / BURN / FEE_IN / *_ALLOC entry.
- `FeeSnapshot` — periodic snapshots of pending vs. collected fees and their 50/50 split.
- `DistributionRound` — recorded airdrop plans + signatures.

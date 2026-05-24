# StableCasino Operations Runbook

## Before going live

1. **Launch the token on Pump.fun** with the wallet you intend to use as the casino creator. Save its public key as `PUMP_CREATOR_PUBLIC_KEY` in `backend/.env`.
2. **Fund the casino bankroll wallet** with USDC. The base-58 secret key goes into `CASINO_BANKROLL_PRIVATE_KEY`. *(Keep this server-side only; never ship to the frontend.)*
3. **Set the actual mints:** `STABLE_MINT` (your $STABLECASINO mint) and `USDC_MINT` (the canonical USDC mainnet mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
4. **Pick a real Solana RPC** — public endpoints will throttle. The default in `.env.example` uses Helius (`https://mainnet.helius-rpc.com/?api-key=...`); swap in your key. Triton, QuickNode, etc. also work.
5. **Set risk parameters (both min and max bet auto-scale from the bankroll):**
   - `HOLDER_MIN_BALANCE` — minimum $STABLECASINO required to access the play page.
   - `MAX_BET_BANKROLL_FRACTION_BPS` — fraction of bankroll permitted to be exposed per bet (default 200 = 2%).
   - `ABSOLUTE_MAX_BET_USDC` — hard ceiling on a single bet regardless of bankroll size.
   - `MIN_BET_RATIO_DIVISOR` — min bet is `maxBet / divisor` (default 100, so min is 1% of the current max bet).
   - `MIN_BET_FLOOR_USDC` — absolute floor (default 0.1) so a thinly funded bankroll still quotes a sensible minimum.

## Operational loops

### Fee collection
Run periodically (e.g. hourly cron):

```bash
curl -X POST http://localhost:4000/fees/collect -d '{"submit": true}' -H 'Content-Type: application/json'
```

This pulls accumulated creator fees on-chain into the bankroll wallet (lamports / SOL). Convert to USDC via your preferred path (e.g. Jupiter swap script) and split the proceeds 50/50 per `snapshotFeesAndAllocate`.

### Holder snapshot + airdrop
A separate script should:

1. Read all $STABLECASINO holders (e.g. via Helius DAS or a token-holders index).
2. Call `computeProportional({ totalLamports, holders })` to size payouts.
3. Submit USDC transfers in batches (typically 5–10 per tx).
4. Persist the result via `recordDistribution`.

This piece is intentionally off-band: holder enumeration is RPC-heavy and benefits from running outside the request path.

## Monitoring

- Each game writes ledger entries (`BET_IN`, `PAYOUT_OUT`, `BURN`). Keep an eye on bankroll drawdown.
- `GET /blackjack/max-bet` should always show `availableUsdcRaw > 0` during play.
- Alert if the bankroll's USDC balance < safety threshold.

## Disaster recovery

- The blackjack engine is deterministic from `(seed, cursor)`. Any disputed hand can be replayed and verified.
- All settlement tx signatures are stored on `Game.payoutTx` / `Game.burnTx`.
- Rotate bankroll keys by transferring funds to a new wallet and updating `CASINO_BANKROLL_PRIVATE_KEY`.

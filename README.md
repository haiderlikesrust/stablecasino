# StableCasino

A Solana-native casino + token MVP.

- **$STABLECASINO** token on Solana mainnet (Pump.fun launched).
- Pump creator/transaction fees are accumulated; **50%** is distributed to top holders as USDC airdrops, **50%** funds the casino bankroll.
- Holders gamble airdropped USDC by swapping it into $STABLECASINO and playing **Blackjack**.
- Lost $STABLECASINO is **burned**; winning hands are paid out in **USDC** from the casino bankroll.
- A dynamic **max bet** is enforced so the casino can never owe more than it can pay.

## Monorepo layout

```
stablecasino/
  backend/    # Express + TypeScript + Prisma (PostgreSQL)
  frontend/   # Next.js (App Router) + Tailwind + Solana Wallet Adapter
```

## Quick start

> Requires Node 20+ and a PostgreSQL database (any provider). For local dev you can also use Docker.

```bash
npm install

# Configure backend env (Solana, DB, bankroll, mints)
cp backend/.env.example backend/.env
# Configure frontend env (API URL, RPC, mints)
cp frontend/.env.example frontend/.env.local

# Initialize the database
npm --workspace backend run prisma:generate
npm --workspace backend run prisma:migrate

# Run backend + frontend in two terminals
npm run dev:backend
npm run dev:frontend
```

Backend listens on `http://localhost:4000`, frontend on `http://localhost:3000`.

## Production deploy

For Ubuntu VPS deployment with Nginx + systemd, see:

- `docs/production-deploy.md`
- `ops/server/bootstrap-ubuntu.sh`
- `ops/server/deploy-app.sh`

## Environment

All Solana addresses are env-driven so the MVP can ship with placeholders today and be flipped to live mainnet addresses by editing `.env` files. See `backend/.env.example` and `frontend/.env.example`.

## Disclaimer

This software is provided as-is for educational purposes. Online gambling may be illegal in your jurisdiction. The operators are responsible for legal compliance. Custody of bankroll keys is sensitive — never deploy the backend with the example keys.

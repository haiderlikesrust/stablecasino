'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { Navbar } from '@/components/ui/Navbar';
import { Footer } from '@/components/ui/Footer';
import { useAuth } from '@/components/auth/AuthProvider';
import { BlackjackTable } from '@/components/game/BlackjackTable';
import { BetControls } from '@/components/game/BetControls';
import { GameActions } from '@/components/game/GameActions';
import {
  apiFetch,
  EligibilityResponse,
  GameSnapshot,
  MaxBetResponse,
  SettleResponse,
  StartGameResponse,
} from '@/lib/api';
import { formatCompact } from '@/lib/format';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false },
);

const ticker = process.env.NEXT_PUBLIC_TOKEN_TICKER ?? 'STABLECASINO';

export default function PlayPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { token, wallet, signIn, signOut, loading: authLoading, error: authError } = useAuth();

  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [maxBet, setMaxBet] = useState<MaxBetResponse | null>(null);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSettle, setLastSettle] = useState<SettleResponse | null>(null);

  const refreshEligibility = useCallback(async () => {
    if (!token) return;
    try {
      const e = await apiFetch<EligibilityResponse>('/player/eligibility', { token });
      setEligibility(e);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token]);

  const refreshMaxBet = useCallback(async () => {
    if (!token) return;
    try {
      const mb = await apiFetch<MaxBetResponse>('/blackjack/max-bet', { token });
      setMaxBet(mb);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshEligibility();
    refreshMaxBet();
    // Re-poll max-bet (price + bankroll snapshot) every 10s so the displayed
    // bounds keep up with live Pump.fun price moves.
    const id = setInterval(() => {
      refreshMaxBet();
    }, 10_000);
    return () => clearInterval(id);
  }, [token, refreshEligibility, refreshMaxBet]);

  const handleStart = useCallback(
    async (betStable: number) => {
      if (!token || !publicKey || !signTransaction) return;
      setBusy(true);
      setError(null);
      setLastSettle(null);
      try {
        const result = await apiFetch<StartGameResponse>('/blackjack/start', {
          method: 'POST',
          token,
          body: JSON.stringify({ betStable }),
        });

        const txBuf = Uint8Array.from(atob(result.escrowTransaction), (c) => c.charCodeAt(0));
        const tx = Transaction.from(txBuf);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
        });
        await connection.confirmTransaction(sig, 'confirmed');

        await apiFetch<{ confirmed: boolean }>('/blackjack/confirm', {
          method: 'POST',
          token,
          body: JSON.stringify({ gameId: result.gameId, signature: sig }),
        });

        setCurrentGameId(result.gameId);
        setGame(result.game);
        await refreshMaxBet();
        await refreshEligibility();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [token, publicKey, signTransaction, connection, refreshEligibility, refreshMaxBet],
  );

  const sendAction = useCallback(
    async (action: 'hit' | 'stand' | 'double') => {
      if (!token || !currentGameId) return;
      setBusy(true);
      setError(null);
      try {
        const next = await apiFetch<GameSnapshot>('/blackjack/action', {
          method: 'POST',
          token,
          body: JSON.stringify({ gameId: currentGameId, action }),
        });
        setGame(next);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [token, currentGameId],
  );

  const handleSettle = useCallback(async () => {
    if (!token || !currentGameId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<SettleResponse>('/blackjack/settle', {
        method: 'POST',
        token,
        body: JSON.stringify({ gameId: currentGameId }),
      });
      setLastSettle(result);
      await refreshMaxBet();
      await refreshEligibility();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, currentGameId, refreshMaxBet, refreshEligibility]);

  const handleNewHand = useCallback(() => {
    setGame(null);
    setCurrentGameId(null);
    setLastSettle(null);
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-ink-950 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-300">
                Casino &middot; live table
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tightest sm:text-5xl">
                Blackjack <span className="text-accent-400">table</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                Hold ${ticker} to take a seat. Wins are paid in{' '}
                <span className="font-semibold text-mint-400">USDC</span> from the casino
                bankroll; losses burn your wagered ${ticker}.
              </p>
            </div>
            {token ? (
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-ink-600/80 bg-ink-900/50 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-accent-400 hover:text-accent-300"
              >
                Sign out
              </button>
            ) : null}
          </div>

          {/* Gate */}
          {!connected ? (
            <Gate
              title="Connect your Solana wallet"
              subtitle={`You'll need a wallet that holds $${ticker} to enter the table.`}
              action={<WalletMultiButton />}
            />
          ) : !token ? (
            <Gate
              title="Sign in to play"
              subtitle="One quick signature proves you own this wallet. No gas, no transaction."
              action={
                <button
                  type="button"
                  onClick={() => signIn().catch(() => {})}
                  className="rounded-xl bg-accent-500 px-5 py-3 font-display font-semibold text-ink-950 shadow-glow hover:bg-accent-400 disabled:opacity-50"
                  disabled={authLoading}
                >
                  {authLoading ? 'Signing...' : `Sign in as ${publicKey?.toBase58().slice(0, 4)}...${publicKey?.toBase58().slice(-4)}`}
                </button>
              }
              error={authError}
            />
          ) : eligibility && !eligibility.eligible ? (
            <Gate
              title={`You need at least ${formatCompact(eligibility.minBalance)} $${ticker} to play`}
              subtitle={`Current balance: ${formatCompact(eligibility.stableBalance)} $${ticker}. Pick up some on Pump.fun and come back.`}
              action={
                <a
                  href={process.env.NEXT_PUBLIC_PUMP_FUN_URL ?? 'https://pump.fun'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-accent-500 px-5 py-3 font-display font-semibold text-ink-950 shadow-glow hover:bg-accent-400"
                >
                  Buy ${ticker}
                </a>
              }
            />
          ) : (
            <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
              <BlackjackTable game={game} busy={busy} />

              <aside className="space-y-6">
                <BalancePanel eligibility={eligibility} walletStr={wallet} />

                <MaxBetPanel maxBet={maxBet} />
                <FairnessPanel game={game} />

                {game && game.state !== 'SETTLED' ? (
                  <GameActions
                    game={game}
                    onHit={() => sendAction('hit')}
                    onStand={() => sendAction('stand')}
                    onDouble={() => sendAction('double')}
                    onSettle={handleSettle}
                    onNewHand={handleNewHand}
                    busy={busy}
                  />
                ) : game && game.state === 'SETTLED' ? (
                  <>
                    {lastSettle ? <SettleSummary settle={lastSettle} /> : null}
                    <GameActions
                      game={game}
                      onHit={() => sendAction('hit')}
                      onStand={() => sendAction('stand')}
                      onDouble={() => sendAction('double')}
                      onSettle={handleSettle}
                      onNewHand={handleNewHand}
                      busy={busy}
                    />
                  </>
                ) : maxBet ? (
                  <BetControls
                    minBetStable={maxBet.minBetStable}
                    maxBetStable={maxBet.maxBetStable}
                    minBetUsdc={maxBet.minBetUsdc}
                    maxBetUsdc={maxBet.maxBetUsdc}
                    disabled={busy}
                    onStart={handleStart}
                  />
                ) : null}
              </aside>

              {error ? (
                <div className="lg:col-span-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Gate({
  title,
  subtitle,
  action,
  error,
}: {
  title: string;
  subtitle: string;
  action: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div className="mt-12 grid place-items-center">
      <div className="gradient-border w-full max-w-md rounded-3xl bg-ink-850/70 p-8 text-center shadow-glow backdrop-blur">
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
        <div className="mt-6 flex justify-center">{action}</div>
        {error ? (
          <p className="mt-4 rounded-lg border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-xs text-ember-400">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BalancePanel({
  eligibility,
  walletStr,
}: {
  eligibility: EligibilityResponse | null;
  walletStr: string | null;
}) {
  return (
    <div className="gradient-border rounded-2xl bg-ink-850/70 p-5 shadow-sheen backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">Wallet</p>
        <p className="font-mono text-xs text-zinc-300">
          {walletStr ? `${walletStr.slice(0, 4)}…${walletStr.slice(-4)}` : '—'}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-3 shadow-sheen">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            ${ticker}
          </p>
          <p
            className="mt-1 font-display text-lg font-semibold tracking-tight text-accent-300"
            title={eligibility?.stableBalance ?? undefined}
            data-numeric
          >
            {formatCompact(eligibility?.stableBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-3 shadow-sheen">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">USDC</p>
          <p
            className="mt-1 font-display text-lg font-semibold tracking-tight text-mint-400"
            title={eligibility?.usdcBalance ?? undefined}
            data-numeric
          >
            {formatCompact(eligibility?.usdcBalance)}
          </p>
        </div>
      </div>
    </div>
  );
}

function MaxBetPanel({ maxBet }: { maxBet: MaxBetResponse | null }) {
  return (
    <div className="gradient-border rounded-2xl bg-ink-850/70 p-5 shadow-sheen backdrop-blur">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        Casino bankroll
      </p>
      <p
        className="mt-1 font-display text-2xl font-bold tracking-tight text-gold-400"
        title={maxBet?.bankrollUsdc ?? undefined}
        data-numeric
      >
        {formatCompact(maxBet?.bankrollUsdc)}{' '}
        <span className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-gold-400/70">
          USDC
        </span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 p-2.5 shadow-sheen">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Max bet</p>
          <p
            className="font-display text-sm font-semibold text-accent-300"
            title={maxBet?.maxBetStable ?? undefined}
            data-numeric
          >
            {formatCompact(maxBet?.maxBetStable)} {ticker}
          </p>
          <p className="font-mono text-[10px] text-mint-400" data-numeric>
            ≈ {formatCompact(maxBet?.maxBetUsdc)} USDC
          </p>
        </div>
        <div className="rounded-lg border border-ink-700/70 bg-ink-900/60 p-2.5 shadow-sheen">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Min bet</p>
          <p
            className="font-display text-sm font-semibold text-zinc-200"
            title={maxBet?.minBetStable ?? undefined}
            data-numeric
          >
            {formatCompact(maxBet?.minBetStable)} {ticker}
          </p>
          <p className="font-mono text-[10px] text-mint-400" data-numeric>
            ≈ {formatCompact(maxBet?.minBetUsdc)} USDC
          </p>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
        Bounds auto-scale with bankroll, exposure, and the live ${ticker} price.
      </p>
    </div>
  );
}

function SettleSummary({ settle }: { settle: SettleResponse }) {
  const won = settle.payoutUsdc && BigInt(settle.payoutUsdc) > 0n;
  const burned = settle.burnedStableRaw && BigInt(settle.burnedStableRaw) > 0n;
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sheen ${
        won
          ? 'border-mint-500/40 bg-mint-500/10 text-mint-300'
          : 'border-ink-700/80 bg-ink-900/60 text-zinc-200'
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-80">Settlement</p>
      <p className="mt-1 font-display text-lg font-bold tracking-tight">
        {settle.alreadySettled ? 'Already settled' : settle.outcome ?? 'Final'}
      </p>
      <div className="mt-3 space-y-1 text-xs">
        {settle.betStable ? (
          <p>
            Bet size: <span className="font-mono" data-numeric>{formatCompact(settle.betStable)}</span>{' '}
            {ticker}
          </p>
        ) : null}
        {burned ? (
          <p className="text-ember-400">
            Burned:{' '}
            <span className="font-mono" data-numeric>
              {formatCompact(settle.burnedStable)}
            </span>{' '}
            {ticker}
          </p>
        ) : (
          <p className="text-zinc-400">No burn on this hand.</p>
        )}
        {settle.payoutTx ? (
          <p>
            Payout tx:{' '}
            <a
              href={`https://solscan.io/tx/${settle.payoutTx}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline-offset-2 hover:underline"
            >
              {settle.payoutTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
        {settle.burnTx ? (
          <p>
            Burn tx:{' '}
            <a
              href={`https://solscan.io/tx/${settle.burnTx}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline-offset-2 hover:underline"
            >
              {settle.burnTx.slice(0, 10)}…
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function FairnessPanel({ game }: { game: GameSnapshot | null }) {
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const fairness = game?.fairness;

  const canVerify = Boolean(fairness?.revealedSeed && fairness?.seedCommitment);

  const handleVerify = useCallback(async () => {
    if (!fairness?.revealedSeed) return;
    try {
      const computed = await sha256Hex(fairness.revealedSeed);
      const ok = computed === fairness.seedCommitment;
      setVerifyResult(
        ok
          ? 'Verified: SHA-256(seed) matches the original commitment.'
          : `Mismatch: expected ${fairness.seedCommitment.slice(0, 12)}..., got ${computed.slice(0, 12)}...`,
      );
    } catch (err) {
      setVerifyResult((err as Error).message);
    }
  }, [fairness]);

  return (
    <div className="gradient-border rounded-2xl bg-ink-850/70 p-5 shadow-sheen backdrop-blur">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mint-400">
        Provably fair
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
        No hidden rake:{' '}
        <span className="font-semibold text-mint-400">0% fee edge</span>. Each hand commits a
        server seed hash before actions, then reveals the seed after settlement so anyone can
        replay the shuffle.
      </p>
      {fairness ? (
        <div className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-zinc-400">
          <p>
            Commit:{' '}
            <span className="font-mono text-zinc-300">
              {fairness.seedCommitment.slice(0, 20)}…
            </span>
          </p>
          <p>
            Rules: {fairness.numDecks} decks · {fairness.dealerHitsSoft17 ? 'H17' : 'S17'} · BJ{' '}
            {fairness.blackjackPayout} · double {fairness.doubleRule}
          </p>
          {fairness.revealedSeed ? (
            <p>
              Revealed seed:{' '}
              <span className="font-mono text-zinc-300">
                {fairness.revealedSeed.slice(0, 20)}…
              </span>
            </p>
          ) : (
            <p>Seed reveal unlocks when this hand is settled.</p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[11px] text-zinc-500">
          Start a hand to see its fairness proof.
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!canVerify}
          onClick={() => handleVerify().catch(() => {})}
          className="rounded-lg border border-mint-500/40 bg-mint-500/5 px-3 py-1.5 text-xs font-medium text-mint-300 transition hover:bg-mint-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Verify hand proof
        </button>
        {verifyResult ? <p className="text-[11px] text-zinc-400">{verifyResult}</p> : null}
      </div>
    </div>
  );
}

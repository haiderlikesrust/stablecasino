import Link from 'next/link';
import { Navbar } from '@/components/ui/Navbar';
import { Footer } from '@/components/ui/Footer';
import { Logo } from '@/components/ui/Logo';
import { CopyContractButton } from '@/components/ui/CopyContractButton';
import { CoinStats } from '@/components/home/CoinStats';
import { BurnTracker } from '@/components/home/BurnTracker';
import { EligibleHolders } from '@/components/home/EligibleHolders';

const ticker = process.env.NEXT_PUBLIC_TOKEN_TICKER ?? 'STABLECASINO';
const contractAddress = process.env.NEXT_PUBLIC_STABLE_MINT ?? 'Set NEXT_PUBLIC_STABLE_MINT';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="relative isolate overflow-hidden bg-ink-950 text-zinc-100">
        {/* Hero */}
        <section className="relative bg-felt-gradient">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-28">
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-mint-400/70" />
                  <span className="relative h-2 w-2 rounded-full bg-mint-400 shadow-mint" />
                </span>
                Live on Solana mainnet
              </span>
              <h1 className="mt-6 font-display text-[44px] font-bold leading-[1.02] tracking-tightest sm:text-6xl">
                The casino that{' '}
                <span className="relative inline-block">
                  <span className="text-shimmer">pays</span>
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-accent-400 via-accent-500 to-mint-400 opacity-80"
                  />
                </span>{' '}
                its holders.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
                <span className="font-semibold text-zinc-100">${ticker}</span> is a Solana token
                whose trading fees are split{' '}
                <span className="font-semibold text-accent-300">50 / 50</span> — half airdropped
                to top holders in{' '}
                <span className="font-semibold text-mint-400">USDC</span>, half feeding a real
                blackjack bank where losses are burned and wins pay out instantly.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/play"
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-accent-400 to-accent-600 px-6 py-3 font-display font-semibold text-ink-950 shadow-glow-strong transition hover:from-accent-300 hover:to-accent-500"
                >
                  <span className="relative z-10">Enter the casino</span>
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                </Link>
                <CopyContractButton address={contractAddress} />
              </div>

              <dl
                className="mt-12 grid grid-cols-3 gap-6 border-t border-ink-700/60 pt-8 text-center sm:text-left"
                data-numeric
              >
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    Holder split
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-accent-300">50%</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    Casino bank
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-gold-400">50%</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    Payout
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-mint-400">USDC</dd>
                </div>
              </dl>
            </div>

            <HeroCardArt />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
            <CoinStats />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-ink-700/60 bg-ink-900/40 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="The flow"
              title="From buy to airdrop to blackjack"
              description="Every $STABLECASINO trade generates fees on Pump.fun. Those fees become the engine that pays holders and funds the casino bankroll."
            />

            <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Step
                index="1"
                title="Buy $STABLECASINO"
                body="Anyone can buy the coin on Pump.fun. Every trade pays fees back to the creator wallet."
              />
              <Step
                index="2"
                title="Fees accumulate"
                body="Our backend reads the live, uncollected creator-fee balance from the Pump SDK."
              />
              <Step
                index="3"
                title="50% airdrops to holders"
                body="Half of collected fees are distributed in USDC, proportional to your $STABLECASINO holdings."
              />
              <Step
                index="4"
                title="50% funds the bank"
                body="The other half tops up the casino bankroll that pays blackjack winners in USDC."
              />
            </ol>
          </div>
        </section>

        {/* Tokenomics / flow diagram */}
        <section id="tokenomics" className="border-t border-ink-700/60 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Where the money goes"
              title="Two destinations, one token"
              description="Holders are aligned with the house. Bigger volume means bigger airdrops and a fatter bankroll funding bigger wins."
            />

            <div className="mt-14 grid gap-8 lg:grid-cols-3">
              <FlowCard
                tag="Input"
                color="text-zinc-200"
                title="Pump.fun creator fees"
                body="Every trade in $STABLECASINO produces fees."
              />
              <FlowCard
                tag="50% Airdrop"
                color="text-accent-400"
                title="Top holders earn USDC"
                body="Snapshots run periodically. Holders receive USDC drops sized to their share of supply."
              />
              <FlowCard
                tag="50% Bankroll"
                color="text-gold-400"
                title="Casino reserve"
                body="Funds the table. A dynamic max-bet keeps the bank solvent on every hand."
              />
            </div>
          </div>
        </section>

        {/* Blackjack mechanics */}
        <section id="airdrop" className="border-t border-ink-700/60 bg-ink-900/40 py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <SectionHeading
                eyebrow="The table"
                title="Got airdropped USDC? Choose your side."
                description="You can hold and wait for the next airdrop, or take your USDC to the blackjack table — but only $STABLECASINO holders get a seat."
                inline
              />

              <div className="mt-10 space-y-5 text-zinc-300">
                <BulletRow
                  label="1. Swap to play"
                  body={`Convert your USDC into $${ticker}. The casino only accepts the native token at the table.`}
                />
                <BulletRow
                  label="2. Play blackjack"
                  body="Standard 6-deck shoe, dealer hits soft 17, blackjack pays 3:2. The shuffle is server-seeded and verifiable."
                />
                <BulletRow
                  label="3. Lose → burn"
                  body={`If you lose, your wagered $${ticker} is sent to the burn address. Supply shrinks; remaining holders win.`}
                />
                <BulletRow
                  label="4. Win → USDC"
                  body="Winning hands are paid in USDC straight from the casino bankroll wallet."
                />
                <BulletRow
                  label="5. Max bet auto-sized"
                  body="The backend computes the max bet from the bankroll in real time, so the house always pays what it owes."
                />
              </div>

              <Link
                href="/play"
                className="mt-10 inline-flex items-center justify-center rounded-xl bg-accent-500 px-6 py-3 font-display font-semibold text-ink-950 shadow-glow transition hover:bg-accent-400"
              >
                Connect wallet and play
              </Link>
            </div>

            <TableArt />
          </div>
        </section>

        {/* Burn furnace */}
        <section id="burn" className="border-t border-ink-700/60 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <BurnTracker />
          </div>
        </section>

        {/* Eligible holders */}
        <section id="holders" className="border-t border-ink-700/60 bg-ink-900/40 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <EligibleHolders />
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-ink-700/60 py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Questions"
              title="Frequently asked"
              center
            />
            <div className="mt-12 space-y-6">
              <Faq
                q="Who is allowed to play?"
                a={`The Play page is gated. You need to connect a Solana wallet that holds at least the configured minimum of $${ticker}. The threshold is set by the operator and can change.`}
              />
              <Faq
                q="How is the deck shuffled?"
                a="A 6-deck shoe is Fisher-Yates shuffled using a SHA-256 keystream over a per-game server seed. The seed and cursor are persisted, so any hand can be replayed deterministically by anyone."
              />
              <Faq
                q="What stops the casino from going broke?"
                a="Every potential bet is sized against the available USDC bankroll, with a configurable cap (default ~2%) and a hard absolute ceiling. The max bet shrinks automatically as exposure grows."
              />
              <Faq
                q="How are airdrops calculated?"
                a={`We snapshot $${ticker} balances when fees are collected, then distribute 50% of accumulated fees as USDC, proportional to holdings.`}
              />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function HeroCardArt() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 -z-10 bg-felt-gradient opacity-70 blur-3xl" />
      <div className="gradient-border relative grid w-full max-w-md rotate-1 grid-cols-3 gap-3 rounded-3xl bg-ink-850/80 p-6 shadow-glow-strong backdrop-blur">
        <Card label="A" suit="♠" highlight />
        <Card label="K" suit="♦" />
        <Card label="Q" suit="♣" />
        <div className="col-span-3 flex items-center gap-4 rounded-xl border border-accent-500/30 bg-ink-900/80 p-4 shadow-sheen">
          <Logo className="h-12 w-12 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mint-400">
              Settled in USDC
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-zinc-100">
              Blackjack pays 3:2
            </p>
            <p className="text-sm text-zinc-400">
              Wins land directly in your wallet as USDC.
            </p>
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-3 gap-3 text-center text-xs">
          <Pill label="Bet" value="$10" />
          <Pill label="Max bet" value="auto" accent="gold" />
          <Pill label="Payout" value="USDC" accent="mint" />
        </div>
      </div>
    </div>
  );
}

function Card({ label, suit, highlight }: { label: string; suit: string; highlight?: boolean }) {
  const red = suit === '♥' || suit === '♦';
  return (
    <div
      className={`card-face flex h-32 flex-col items-start justify-between rounded-xl p-3 ${
        highlight ? 'ring-2 ring-accent-400 shadow-glow' : ''
      }`}
    >
      <span
        className={`font-display text-2xl font-bold ${red ? 'text-red-600' : 'text-accent-700'}`}
      >
        {label}
      </span>
      <span className={`self-end text-3xl ${red ? 'text-red-600' : 'text-accent-700'}`}>{suit}</span>
    </div>
  );
}

function Pill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'gold' | 'mint';
}) {
  const valueColor =
    accent === 'gold' ? 'text-gold-400' : accent === 'mint' ? 'text-mint-400' : 'text-zinc-100';
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-900/70 px-2 py-1.5 shadow-sheen">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className={`font-display text-sm font-semibold ${valueColor}`} data-numeric>
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  center,
  inline,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  center?: boolean;
  inline?: boolean;
}) {
  return (
    <div
      className={`${center ? 'text-center mx-auto max-w-2xl' : ''} ${inline ? '' : 'max-w-3xl'}`}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-zinc-400">{description}</p>
      ) : null}
    </div>
  );
}

function Step({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <li className="group relative overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850/60 p-6 shadow-sheen transition-colors hover:border-accent-500/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-500/10 blur-2xl transition-opacity group-hover:bg-accent-500/20"
      />
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-accent-500/30 bg-accent-500/10 font-display text-sm font-bold text-accent-300">
        {index}
      </div>
      <h3 className="relative mt-5 font-display text-lg font-semibold tracking-tight">{title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
    </li>
  );
}

function FlowCard({
  tag,
  color,
  title,
  body,
}: {
  tag: string;
  color: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-850/60 p-7 shadow-sheen transition hover:border-accent-500/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/60 to-transparent"
      />
      <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.24em] ${color}`}>
        {tag}
      </p>
      <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function BulletRow({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-400" />
      <div>
        <p className="font-display text-sm font-semibold text-zinc-100">{label}</p>
        <p className="text-sm text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

function TableArt() {
  return (
    <div className="relative grid place-items-center">
      <div className="felt relative w-full max-w-md rounded-[28px] border border-accent-500/20 px-8 py-10 shadow-glow animate-glow">
        <div className="flex justify-center gap-2">
          <Card label="A" suit="♠" highlight />
          <Card label="J" suit="♦" />
        </div>
        <p className="mt-6 text-center font-display text-xl text-zinc-200">
          Dealer shows <span className="text-accent-400">10</span>
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <ChipButton label="Hit" />
          <ChipButton label="Stand" emphasis />
          <ChipButton label="Double" />
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">
          Lose → burn $STABLECASINO &middot; Win → USDC payout
        </p>
      </div>
    </div>
  );
}

function ChipButton({ label, emphasis }: { label: string; emphasis?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center font-display text-sm font-semibold ${
        emphasis
          ? 'border-accent-500 bg-accent-500/10 text-accent-400'
          : 'border-ink-600 bg-ink-900/60 text-zinc-200'
      }`}
    >
      {label}
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-ink-700/70 bg-ink-850/60 p-6 shadow-sheen transition hover:border-accent-500/40">
      <summary className="flex cursor-pointer items-center justify-between font-display text-base font-semibold tracking-tight text-zinc-100">
        {q}
        <span className="ml-4 grid h-7 w-7 place-items-center rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-300 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-4 text-sm leading-relaxed text-zinc-400">{a}</p>
    </details>
  );
}

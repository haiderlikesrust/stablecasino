'use client';

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative border-t border-ink-700/50 bg-ink-950 px-4 py-12 text-sm text-zinc-400 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/40 to-transparent"
      />
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-start">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-zinc-100">
            Stable<span className="text-accent-400">Casino</span>
          </p>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-zinc-500">
            $STABLECASINO is a Solana experiment. Online gambling may be illegal in your
            jurisdiction. You alone are responsible for your funds and tax obligations.
            Nothing on this site is financial or legal advice.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
            Explore
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium text-zinc-400">
            <Link href="/#how" className="transition-colors hover:text-zinc-100">
              How it works
            </Link>
            <Link href="/#tokenomics" className="transition-colors hover:text-zinc-100">
              Tokenomics
            </Link>
            <Link href="/#burn" className="transition-colors hover:text-zinc-100">
              Burn
            </Link>
            <Link href="/play" className="transition-colors hover:text-zinc-100">
              Play
            </Link>
            <a
              href={process.env.NEXT_PUBLIC_PUMP_FUN_URL ?? 'https://pump.fun'}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-zinc-100"
            >
              Pump.fun
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

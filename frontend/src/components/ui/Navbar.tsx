'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Logo } from './Logo';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false },
);

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/50 bg-ink-950/70 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-accent-500/40 to-transparent"
      />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <Logo className="h-9 w-9 drop-shadow-[0_0_14px_rgba(74,152,238,0.55)] transition-transform group-hover:rotate-[-4deg]" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-[17px] font-semibold tracking-tight">
              Stable<span className="text-accent-400">Casino</span>
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              Solana &middot; USDC payouts
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-400 md:flex">
          <Link href="/#how" className="transition-colors hover:text-zinc-100">
            How it works
          </Link>
          <Link href="/#tokenomics" className="transition-colors hover:text-zinc-100">
            Tokenomics
          </Link>
          <Link href="/#airdrop" className="transition-colors hover:text-zinc-100">
            Airdrops
          </Link>
          <Link href="/#burn" className="transition-colors hover:text-zinc-100">
            Burn
          </Link>
          <Link href="/play" className="transition-colors hover:text-zinc-100">
            Play
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/play"
            className="hidden rounded-lg border border-ink-600/70 bg-ink-900/50 px-3.5 py-2 text-sm font-semibold text-zinc-200 transition-all hover:border-accent-400/70 hover:text-white hover:shadow-[0_0_24px_-10px_rgba(74,152,238,0.6)] md:inline-flex md:items-center md:gap-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-mint-400 shadow-mint" />
            Open Casino
          </Link>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}

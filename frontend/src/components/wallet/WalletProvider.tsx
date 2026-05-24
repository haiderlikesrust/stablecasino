'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { API_BASE } from '@/lib/api';

const FALLBACK_RPC = 'https://api.mainnet-beta.solana.com';
const PUBLIC_RPC_HOSTS = ['api.mainnet-beta.solana.com', 'api.devnet.solana.com'];

function isPublicEndpoint(url: string): boolean {
  try {
    return PUBLIC_RPC_HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
}

export function WalletProviderShell({ children }: { children: ReactNode }) {
  // Always prefer backend /config so the browser uses SOLANA_RPC_URL from
  // backend/.env (Helius). NEXT_PUBLIC_SOLANA_RPC_URL is now only a fallback
  // if /config fails or omits solanaRpcUrl.
  const envEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/config`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { solanaRpcUrl?: string }) => {
        if (cancelled) return;
        if (data.solanaRpcUrl) {
          setEndpoint(data.solanaRpcUrl);
        } else {
          const fallback = envEndpoint ?? FALLBACK_RPC;
          console.warn(
            '[stablecasino] /config returned no solanaRpcUrl; falling back to',
            fallback,
          );
          setEndpoint(fallback);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const fallback = envEndpoint ?? FALLBACK_RPC;
        console.warn(
          '[stablecasino] failed to load backend RPC config, falling back to',
          fallback,
          err,
        );
        setEndpoint(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [envEndpoint]);

  useEffect(() => {
    if (endpoint && isPublicEndpoint(endpoint)) {
      console.warn(
        '[stablecasino] using the public Solana RPC, transactions will likely be rate-limited (HTTP 403). ' +
          'Set SOLANA_RPC_URL in backend/.env (Helius recommended).',
      );
    }
  }, [endpoint]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  if (!endpoint) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 text-sm text-zinc-400">
        Loading network config...
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { apiFetch, NonceResponse, VerifyResponse } from '@/lib/api';

interface AuthState {
  token: string | null;
  wallet: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'stablecasino:token';
const WALLET_KEY = 'stablecasino:wallet';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [state, setState] = useState<AuthState>({
    token: null,
    wallet: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem(TOKEN_KEY);
    const w = localStorage.getItem(WALLET_KEY);
    if (t && w) setState((s) => ({ ...s, token: t, wallet: w }));
  }, []);

  const signOut = useCallback(() => {
    setState({ token: null, wallet: null, loading: false, error: null });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(WALLET_KEY);
    }
    disconnect().catch(() => {});
  }, [disconnect]);

  // If wallet disconnects or changes, drop the session
  useEffect(() => {
    if (!connected) return;
    if (state.wallet && publicKey && publicKey.toBase58() !== state.wallet) {
      setState({ token: null, wallet: null, loading: false, error: null });
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(WALLET_KEY);
      }
    }
  }, [connected, publicKey, state.wallet]);

  const signIn = useCallback(async () => {
    if (!publicKey) throw new Error('Connect a wallet first');
    if (!signMessage) throw new Error('Wallet does not support message signing');

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const walletStr = publicKey.toBase58();
      const nonceRes = await apiFetch<NonceResponse>('/auth/nonce', {
        method: 'POST',
        body: JSON.stringify({ wallet: walletStr }),
      });

      const msgBytes = new TextEncoder().encode(nonceRes.message);
      const sigBytes = await signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      const verifyRes = await apiFetch<VerifyResponse>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          wallet: walletStr,
          nonce: nonceRes.nonce,
          signature,
        }),
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, verifyRes.token);
        localStorage.setItem(WALLET_KEY, walletStr);
      }
      setState({
        token: verifyRes.token,
        wallet: walletStr,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: (err as Error).message,
      }));
      throw err;
    }
  }, [publicKey, signMessage]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut }),
    [state, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

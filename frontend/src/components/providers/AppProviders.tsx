'use client';

import { ReactNode } from 'react';
import { WalletProviderShell } from '@/components/wallet/WalletProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WalletProviderShell>
      <AuthProvider>{children}</AuthProvider>
    </WalletProviderShell>
  );
}

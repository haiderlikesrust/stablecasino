import type { Metadata } from 'next';
import { Inter, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/providers/AppProviders';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'StableCasino — The Casino That Pays Its Holders',
  description:
    'A Solana token whose transaction fees fund a real blackjack casino and a 50/50 holder airdrop. Hold $STABLECASINO, earn USDC, or take it to the table.',
  openGraph: {
    title: 'StableCasino — The Casino That Pays Its Holders',
    description:
      'Hold $STABLECASINO, earn airdrops, gamble at the blackjack table backed by real treasury.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-ink-950 font-body text-zinc-100 antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

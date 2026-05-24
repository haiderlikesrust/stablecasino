'use client';

import useSWR from 'swr';
import { apiFetch, CoinInfo } from '@/lib/api';

const fetcher = (path: string) => apiFetch<CoinInfo>(path);

/**
 * Live $STABLECASINO market data polled every 7 seconds. Used by anywhere
 * that needs a fresh USD-equivalent conversion (bet controls, max-bet panel,
 * homepage stats). SWR dedupes calls across components automatically.
 */
export function usePrice() {
  const { data, error, isLoading, mutate } = useSWR<CoinInfo>(
    '/coin/info',
    fetcher,
    {
      refreshInterval: 7_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );
  return {
    coin: data ?? null,
    price: data?.priceUsdPerToken ?? null,
    error,
    loading: isLoading,
    refresh: mutate,
  };
}

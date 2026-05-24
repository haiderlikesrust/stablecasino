'use client';

import useSWR from 'swr';
import { apiFetch, BurnStats } from '@/lib/api';

const fetcher = (path: string) => apiFetch<BurnStats>(path);

/**
 * Total burned $STABLECASINO across every settled hand. Polls every 10s so
 * the homepage furnace card animates roughly in step with new burns.
 */
export function useBurnStats() {
  const { data, error, isLoading, mutate } = useSWR<BurnStats>(
    '/coin/burn-stats',
    fetcher,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );
  return {
    stats: data ?? null,
    loading: isLoading,
    error,
    refresh: mutate,
  };
}

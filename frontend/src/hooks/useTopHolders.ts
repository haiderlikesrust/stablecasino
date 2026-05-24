'use client';

import useSWR from 'swr';
import { apiFetch, TopHoldersResponse } from '@/lib/api';

const fetcher = (path: string) => apiFetch<TopHoldersResponse>(path);

/**
 * Top N $STABLECASINO holders + pending airdrop pool. Polled every 15s so the
 * homepage list stays in step with the 10s fee collector and 30m airdrop
 * scheduler.
 */
export function useTopHolders() {
  const { data, error, isLoading, mutate } = useSWR<TopHoldersResponse>(
    '/holders/top',
    fetcher,
    {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );
  return {
    data: data ?? null,
    loading: isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Format a numeric string or number into a compact human display:
 *   1_233_148.669366  ->  "1.23M"
 *   12_345            ->  "12.35K"
 *   3.14              ->  "3.14"
 *   0.000001          ->  "0.000001"
 * Returns "—" when the input is missing or unparseable.
 */
export function formatCompact(
  value: string | number | null | undefined,
  opts: { decimals?: number } = {},
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';

  const decimals = opts.decimals ?? 2;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(decimals)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(decimals)}K`;
  if (abs >= 1) return `${sign}${abs.toFixed(decimals)}`;
  if (abs === 0) return '0';

  // Small fractions: keep enough significant digits to be useful.
  if (abs >= 0.01) return `${sign}${abs.toFixed(4)}`;
  if (abs >= 0.0001) return `${sign}${abs.toFixed(6)}`;
  return `${sign}${abs.toExponential(2)}`;
}

/** Format a USD amount as $X.XXM/K/etc. */
export function formatUsdCompact(value: string | number | null | undefined): string {
  const s = formatCompact(value);
  return s === '—' ? '—' : `$${s}`;
}

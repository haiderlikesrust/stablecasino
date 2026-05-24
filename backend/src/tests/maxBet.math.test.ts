import { describe, it, expect } from 'vitest';
import { parseUnits, formatUnits } from '../lib/token';

describe('token unit math', () => {
  it('round-trips decimal strings', () => {
    const a = parseUnits('123.456', 6);
    expect(a.toString()).toBe('123456000');
    expect(formatUnits(a, 6)).toBe('123.456');
  });

  it('handles zero fractional input', () => {
    const a = parseUnits('10', 6);
    expect(formatUnits(a, 6)).toBe('10');
  });

  it('rejects invalid inputs', () => {
    expect(() => parseUnits('abc', 6)).toThrow();
    expect(() => parseUnits('1.2.3', 6)).toThrow();
  });

  it('truncates extra precision instead of rounding up', () => {
    const a = parseUnits('1.0000007', 6);
    expect(a.toString()).toBe('1000000');
  });

  it('supports negative numbers', () => {
    const a = parseUnits('-5.5', 6);
    expect(a.toString()).toBe('-5500000');
    expect(formatUnits(a, 6)).toBe('-5.5');
  });
});

describe('max bet conceptual math', () => {
  /**
   * Pure-math sanity check on the sizing formula used in
   * src/modules/risk/maxBet.ts:
   *   exposureAllowedRaw  = availableRaw * fractionBps / 10000
   *   maxBetByExposureRaw = exposureAllowedRaw / MAX_PAYOUT_MULTIPLIER (=4)
   */
  function computeMaxBetMath(args: {
    availableRaw: bigint;
    fractionBps: number;
    absoluteCapRaw: bigint;
    maxPayoutMult: number;
  }) {
    const { availableRaw, fractionBps, absoluteCapRaw, maxPayoutMult } = args;
    const exposureAllowedRaw =
      (availableRaw * BigInt(fractionBps)) / 10_000n;
    const byExposure = exposureAllowedRaw / BigInt(maxPayoutMult);
    return byExposure < absoluteCapRaw ? byExposure : absoluteCapRaw;
  }

  it('caps bet at fraction of bankroll divided by max payout multiplier', () => {
    // 1000 USDC bankroll, 2% fraction (200 bps), 4x worst-case payout
    const v = computeMaxBetMath({
      availableRaw: parseUnits('1000', 6),
      fractionBps: 200,
      absoluteCapRaw: parseUnits('500', 6),
      maxPayoutMult: 4,
    });
    // 1000 * 200 / 10000 = 20 ; 20 / 4 = 5 USDC
    expect(v).toBe(parseUnits('5', 6));
  });

  it('caps at absolute USDC cap when bankroll is huge', () => {
    const v = computeMaxBetMath({
      availableRaw: parseUnits('1000000', 6),
      fractionBps: 1000,
      absoluteCapRaw: parseUnits('500', 6),
      maxPayoutMult: 4,
    });
    expect(v).toBe(parseUnits('500', 6));
  });

  it('returns zero when bankroll is zero', () => {
    const v = computeMaxBetMath({
      availableRaw: 0n,
      fractionBps: 200,
      absoluteCapRaw: parseUnits('500', 6),
      maxPayoutMult: 4,
    });
    expect(v).toBe(0n);
  });
});

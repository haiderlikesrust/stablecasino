import { describe, it, expect } from 'vitest';

/**
 * The Pump.fun frontend API returns `total_supply` and
 * `virtual_token_reserves` in *base units* (10^decimals per whole token),
 * so converting to a per-whole-token USD price requires dividing by 10^decimals
 * before dividing the market cap.
 */
describe('pump.fun price math', () => {
  function priceUsdPerWholeToken(args: {
    usdMarketCap: number;
    totalSupplyRaw: number;
    decimals: number;
  }) {
    const scale = 10 ** args.decimals;
    const wholeSupply = args.totalSupplyRaw / scale;
    return args.usdMarketCap / wholeSupply;
  }

  it('computes price per whole token correctly for a typical pump.fun supply', () => {
    // Example response from frontend-api-v3:
    // usd_market_cap=2361.0958, total_supply=1e15 (1B tokens × 1e6 decimals)
    const price = priceUsdPerWholeToken({
      usdMarketCap: 2361.0958,
      totalSupplyRaw: 1_000_000_000_000_000,
      decimals: 6,
    });
    // 2361.0958 / 1e9 ≈ 2.36e-6 USD per whole token
    expect(price).toBeCloseTo(2.361e-6, 9);
  });

  it('produces a max-bet-in-stable that matches expectation', () => {
    const price = priceUsdPerWholeToken({
      usdMarketCap: 2361.0958,
      totalSupplyRaw: 1_000_000_000_000_000,
      decimals: 6,
    });
    // For a 0.0117 USDC max bet, the equivalent in $STABLECASINO whole tokens
    // should be about 4_955 — NOT 2.93B (which would be base-units).
    const maxStable = 0.0117 / price;
    expect(maxStable).toBeGreaterThan(4_000);
    expect(maxStable).toBeLessThan(6_000);
  });

  it('regression: would have produced billions if total_supply was used raw', () => {
    // What the buggy code did:
    const buggyPrice = 2361.0958 / 1_000_000_000_000_000;
    const buggyMaxStable = 0.0117 / buggyPrice;
    expect(buggyMaxStable).toBeGreaterThan(1e9);
  });
});

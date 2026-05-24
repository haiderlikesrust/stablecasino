/**
 * Filter known-harmless noise out of the backend logs.
 *
 * The `@pump-fun/pump-swap-sdk` checks the PumpSwap creator-vault ATA on every
 * `getCreatorVaultBalanceBothPrograms` call. Before the coin graduates from
 * the bonding curve (or before anyone has ever paid into the AMM vault), that
 * ATA simply doesn't exist and the SDK emits:
 *
 *   console.warn(`Error fetching token account ${ata}:`, TokenAccountNotFoundError)
 *
 * It already swallows the error and returns 0, so the warning is purely
 * cosmetic. With our 10s fee scheduler running, it spams the terminal.
 *
 * We intercept `console.warn` once at boot and drop only this exact pattern.
 * All other warnings (including unfamiliar token-account warnings) still pass
 * through unchanged.
 */
const originalWarn = console.warn.bind(console);

const SILENCED_PATTERNS: RegExp[] = [
  /^Error fetching token account [1-9A-HJ-NP-Za-km-z]+:/,
];

console.warn = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === 'string') {
    for (const re of SILENCED_PATTERNS) {
      if (re.test(first)) return;
    }
  }
  originalWarn(...args);
};

export {};

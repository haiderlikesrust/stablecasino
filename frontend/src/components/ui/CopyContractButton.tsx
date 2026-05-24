'use client';

import { useState } from 'react';

export function CopyContractButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center justify-center rounded-xl border border-ink-600/80 bg-ink-900/40 px-6 py-3 font-mono text-xs font-semibold text-zinc-100 transition hover:border-accent-400 hover:text-accent-300"
      title="Click to copy contract address"
    >
      {copied ? 'Copied' : address}
    </button>
  );
}

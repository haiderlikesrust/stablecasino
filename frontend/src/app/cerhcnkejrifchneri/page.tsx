'use client';

import { FormEvent, useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

type RuntimeSettings = {
  SOLANA_CLUSTER: string;
  SOLANA_RPC_URL: string;
  STABLE_MINT: string;
  USDC_MINT: string;
  CASINO_BANKROLL_PUBLIC_KEY: string;
  CASINO_BANKROLL_PRIVATE_KEY: string;
  BURN_ADDRESS: string;
  PUMP_CREATOR_PUBLIC_KEY: string;
  PUMP_FRONTEND_API_URL: string;
};

type TwoFactorStatus = {
  enabled: boolean;
  configured: boolean;
};

const TOKEN_KEY = 'stablecasino:admin-token';

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      (typeof body === 'object' && body && 'error' in body
        ? (body as { error: string }).error
        : null) ?? `Request failed with ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export default function AdminSettingsPage() {
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [twoFactorCodeAction, setTwoFactorCodeAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      request<RuntimeSettings>('/admin/settings', { token }),
      request<TwoFactorStatus>('/admin/2fa/status', { token }),
    ])
      .then(([settingsData, twoFactorData]) => {
        setSettings(settingsData);
        setTwoFactor(twoFactorData);
        setError(null);
      })
      .catch((err) => {
        setError((err as Error).message);
        setToken(null);
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const refreshTwoFactorStatus = async (adminToken: string) => {
    const status = await request<TwoFactorStatus>('/admin/2fa/status', {
      token: adminToken,
    });
    setTwoFactor(status);
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await request<{ token: string }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          password,
          ...(totpCode.trim() ? { totpCode: totpCode.trim() } : {}),
        }),
      });
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      setPassword('');
      setTotpCode('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const setupTwoFactor = async () => {
    if (!token) return;
    setTwoFactorBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await request<{ secret: string; otpauthUri: string }>(
        '/admin/2fa/setup',
        {
          method: 'POST',
          token,
        },
      );
      setSetupSecret(result.secret);
      setSetupUri(result.otpauthUri);
      await refreshTwoFactorStatus(token);
      setSuccess('2FA secret generated. Add it in your authenticator, then enable below.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const enableTwoFactor = async () => {
    if (!token) return;
    setTwoFactorBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await request('/admin/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: twoFactorCodeAction.trim() }),
        token,
      });
      await refreshTwoFactorStatus(token);
      setTwoFactorCodeAction('');
      setSuccess('2FA is now enabled. Login will require password + code.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!token) return;
    setTwoFactorBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await request('/admin/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: twoFactorCodeAction.trim() }),
        token,
      });
      await refreshTwoFactorStatus(token);
      setTwoFactorCodeAction('');
      setSuccess('2FA disabled.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await request<RuntimeSettings>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
        token,
      });
      setSettings(updated);
      setSuccess('Saved. Runtime settings are now updated.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
        <form
          onSubmit={onLogin}
          className="w-full rounded-2xl border border-ink-700/70 bg-ink-900/50 p-6 shadow-sheen"
        >
          <h1 className="font-display text-2xl font-semibold text-zinc-100">Admin</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Enter the admin password to edit live backend settings.
          </p>
          <label className="mt-5 block text-xs uppercase tracking-[0.2em] text-zinc-500">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent-500"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-zinc-500">
            2FA Code (if enabled)
            <input
              type="text"
              inputMode="numeric"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent-500"
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </label>
          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="mt-5 inline-flex rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-ink-700/70 bg-ink-900/50 p-6 shadow-sheen">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-zinc-100">Runtime Settings</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Use this to update contract addresses, keys, and API endpoint without touching `.env`.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setToken(null);
              setSettings(null);
              setTwoFactor(null);
              setSetupSecret(null);
              setSetupUri(null);
              setSuccess(null);
            }}
            className="rounded-lg border border-ink-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 transition hover:border-accent-500 hover:text-accent-300"
          >
            Sign out
          </button>
        </div>

        {loading || !settings ? (
          <p className="mt-6 text-sm text-zinc-400">Loading settings...</p>
        ) : (
          <>
            <section className="mt-6 rounded-xl border border-ink-700/80 bg-ink-950/40 p-4">
              <h2 className="font-display text-lg font-semibold text-zinc-100">Two-Factor Auth</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Status:{' '}
                <span className={twoFactor?.enabled ? 'text-mint-400' : 'text-zinc-200'}>
                  {twoFactor?.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </p>
              {!twoFactor?.configured ? (
                <button
                  type="button"
                  onClick={setupTwoFactor}
                  disabled={twoFactorBusy}
                  className="mt-4 inline-flex rounded-lg border border-accent-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-300 transition hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {twoFactorBusy ? 'Generating...' : 'Generate 2FA secret'}
                </button>
              ) : null}

              {setupSecret ? (
                <div className="mt-4 space-y-2 text-xs text-zinc-300">
                  <p className="uppercase tracking-[0.18em] text-zinc-500">Secret</p>
                  <p className="rounded bg-ink-900 px-2 py-1 font-mono">{setupSecret}</p>
                  <p className="uppercase tracking-[0.18em] text-zinc-500">OTP Auth URI</p>
                  <p className="break-all rounded bg-ink-900 px-2 py-1 font-mono">{setupUri}</p>
                </div>
              ) : null}

              {twoFactor?.configured ? (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Authenticator Code
                    <input
                      type="text"
                      inputMode="numeric"
                      value={twoFactorCodeAction}
                      onChange={(e) => setTwoFactorCodeAction(e.target.value)}
                      className="mt-2 w-44 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-accent-500"
                      placeholder="123456"
                    />
                  </label>
                  {twoFactor?.enabled ? (
                    <button
                      type="button"
                      onClick={disableTwoFactor}
                      disabled={twoFactorBusy}
                      className="inline-flex rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {twoFactorBusy ? 'Working...' : 'Disable 2FA'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={enableTwoFactor}
                      disabled={twoFactorBusy}
                      className="inline-flex rounded-lg border border-mint-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-mint-300 transition hover:bg-mint-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {twoFactorBusy ? 'Working...' : 'Enable 2FA'}
                    </button>
                  )}
                </div>
              ) : null}
            </section>

            <form onSubmit={onSave} className="mt-6 space-y-4">
              {(Object.keys(settings) as Array<keyof RuntimeSettings>).map((key) => (
                <label key={key} className="block text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {key}
                  <input
                    value={settings[key]}
                    onChange={(e) =>
                      setSettings((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))
                    }
                    className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 font-mono text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-accent-500"
                    required
                  />
                </label>
              ))}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {success ? <p className="text-sm text-mint-400">{success}</p> : null}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

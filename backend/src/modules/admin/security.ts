import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { generateSecret, generateURI, verifySync } from 'otplib';

interface AdminSecurityState {
  totpSecret: string | null;
  totpEnabled: boolean;
}

const SECURITY_FILE = path.resolve(process.cwd(), 'data', 'admin-security.json');
const defaultState: AdminSecurityState = {
  totpSecret: null,
  totpEnabled: false,
};

let cachedState: AdminSecurityState | null = null;

function sanitize(raw: unknown): AdminSecurityState {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const secret = typeof src.totpSecret === 'string' && src.totpSecret.trim() ? src.totpSecret : null;
  return {
    totpSecret: secret,
    totpEnabled: Boolean(src.totpEnabled) && Boolean(secret),
  };
}

function persist(state: AdminSecurityState) {
  const dir = path.dirname(SECURITY_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SECURITY_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function getAdminSecurityState(): AdminSecurityState {
  if (cachedState) return cachedState;
  if (!existsSync(SECURITY_FILE)) {
    cachedState = { ...defaultState };
    persist(cachedState);
    return cachedState;
  }
  try {
    const parsed = JSON.parse(readFileSync(SECURITY_FILE, 'utf8')) as unknown;
    cachedState = sanitize(parsed);
  } catch {
    cachedState = { ...defaultState };
  }
  return cachedState;
}

export function setAdminSecurityState(
  patch: Partial<AdminSecurityState>,
): AdminSecurityState {
  const current = getAdminSecurityState();
  const next = sanitize({ ...current, ...patch });
  cachedState = next;
  persist(next);
  return next;
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function getTotpUri(secret: string): string {
  return generateURI({
    issuer: 'StableCasino',
    label: 'admin',
    secret,
    strategy: 'totp',
  });
}

export function verifyTotpCode(code: string): boolean {
  const state = getAdminSecurityState();
  if (!state.totpSecret) return false;
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  return verifySync({
    strategy: 'totp',
    secret: state.totpSecret,
    token: normalized,
  }).valid;
}

import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import {
  getRuntimeSettings,
  runtimeSettingKeys,
  updateRuntimeSettings,
  type RuntimeSettingKey,
} from './runtimeSettings';
import {
  generateTotpSecret,
  getAdminSecurityState,
  getTotpUri,
  setAdminSecurityState,
  verifyTotpCode,
} from './security';

const router = Router();

const ADMIN_TOKEN_TTL = '12h';
const ADMIN_TOKEN_ISSUER = 'stablecasino-admin';

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function issueAdminToken(): string {
  return jwt.sign(
    { role: 'admin' },
    env.JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_TTL, issuer: ADMIN_TOKEN_ISSUER },
  );
}

function requireAdminAuth(header: string | undefined): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: ADMIN_TOKEN_ISSUER,
    }) as { role?: string };
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

const loginSchema = z.object({
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

const updateSchema = z
  .object(
    runtimeSettingKeys.reduce((shape, key) => {
      shape[key] = z.string().min(1).optional();
      return shape;
    }, {} as Record<RuntimeSettingKey, z.ZodOptional<z.ZodString>>),
  )
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one setting',
  });

const codeSchema = z.object({
  code: z.string().min(1),
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }
  if (!safeCompare(parsed.data.password, env.ADMIN_PANEL_PASSWORD)) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const security = getAdminSecurityState();
  if (security.totpEnabled) {
    if (!parsed.data.totpCode) {
      return res.status(401).json({ error: '2FA code required' });
    }
    if (!verifyTotpCode(parsed.data.totpCode)) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }
  }
  res.json({ token: issueAdminToken() });
});

router.use((req, res, next) => {
  if (!requireAdminAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

router.get('/settings', (_req, res) => {
  res.json(getRuntimeSettings());
});

router.put('/settings', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }
  const updated = updateRuntimeSettings(parsed.data);
  res.json(updated);
});

router.get('/2fa/status', (_req, res) => {
  const security = getAdminSecurityState();
  res.json({
    enabled: security.totpEnabled,
    configured: Boolean(security.totpSecret),
  });
});

router.post('/2fa/setup', (_req, res) => {
  const secret = generateTotpSecret();
  setAdminSecurityState({ totpSecret: secret, totpEnabled: false });
  res.json({
    secret,
    otpauthUri: getTotpUri(secret),
    enabled: false,
  });
});

router.post('/2fa/enable', (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }
  const security = getAdminSecurityState();
  if (!security.totpSecret) {
    return res.status(400).json({ error: '2FA is not configured yet' });
  }
  if (!verifyTotpCode(parsed.data.code)) {
    return res.status(401).json({ error: 'Invalid 2FA code' });
  }
  setAdminSecurityState({ totpEnabled: true });
  res.json({ enabled: true });
});

router.post('/2fa/disable', (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }
  const security = getAdminSecurityState();
  if (!security.totpEnabled) {
    return res.status(400).json({ error: '2FA is already disabled' });
  }
  if (!verifyTotpCode(parsed.data.code)) {
    return res.status(401).json({ error: 'Invalid 2FA code' });
  }
  setAdminSecurityState({ totpEnabled: false });
  res.json({ enabled: false });
});

export default router;

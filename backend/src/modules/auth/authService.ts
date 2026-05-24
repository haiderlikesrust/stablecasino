import crypto from 'node:crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import jwt from 'jsonwebtoken';
import { PublicKey } from '@solana/web3.js';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionPayload {
  sub: string; // userId
  wallet: string;
  sid: string; // session id
}

function buildSignMessage(wallet: string, nonce: string): string {
  return `Sign in to StableCasino\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

export async function createNonce(wallet: string) {
  try {
    new PublicKey(wallet);
  } catch {
    throw new Error('Invalid wallet address');
  }

  const nonce = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  await prisma.nonce.create({ data: { wallet, nonce, expiresAt } });

  return {
    nonce,
    message: buildSignMessage(wallet, nonce),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifySignature(args: {
  wallet: string;
  nonce: string;
  signature: string; // base58
}) {
  const { wallet, nonce, signature } = args;

  const record = await prisma.nonce.findUnique({ where: { nonce } });
  if (!record || record.wallet !== wallet) {
    throw new Error('Nonce not found for this wallet');
  }
  if (record.used) throw new Error('Nonce already used');
  if (record.expiresAt < new Date()) throw new Error('Nonce expired');

  const message = buildSignMessage(wallet, nonce);
  const messageBytes = new TextEncoder().encode(message);
  let signatureBytes: Uint8Array;
  let publicKeyBytes: Uint8Array;
  try {
    signatureBytes = bs58.decode(signature);
    publicKeyBytes = bs58.decode(wallet);
  } catch {
    throw new Error('Invalid signature or wallet encoding');
  }

  const ok = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  if (!ok) throw new Error('Signature verification failed');

  await prisma.nonce.update({ where: { nonce }, data: { used: true } });

  const user = await prisma.user.upsert({
    where: { wallet },
    create: { wallet },
    update: {},
  });

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: crypto.randomBytes(32).toString('hex'),
      expiresAt,
    },
  });

  const payload: SessionPayload = { sub: user.id, wallet, sid: session.id };
  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: Math.floor(SESSION_TTL_MS / 1000),
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: { id: user.id, wallet: user.wallet },
  };
}

export function verifySessionToken(token: string): SessionPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as SessionPayload;
  if (!decoded?.sub || !decoded?.wallet) throw new Error('Invalid session');
  return decoded;
}

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'tbm_planner_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''), 'utf8');
  const b = Buffer.from(String(right ?? ''), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function encode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function credentialsMatch(inputUser, inputPassword, credentials) {
  if (!credentials?.username || !credentials?.password) return false;
  return safeEqual(inputUser, credentials.username) && safeEqual(inputPassword, credentials.password);
}

export function createSessionToken({ username, secret, now = Date.now() }) {
  if (!username || !secret) throw new Error('Auth is not configured');
  const payload = encode(JSON.stringify({ username, expiresAt: now + SESSION_TTL_SECONDS * 1000 }));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifySessionToken(token, { secret, now = Date.now() }) {
  if (!token || !secret) return null;
  const [payload, receivedSignature, extra] = String(token).split('.');
  if (!payload || !receivedSignature || extra || !safeEqual(receivedSignature, signature(payload, secret))) return null;
  try {
    const session = JSON.parse(decode(payload));
    if (!session.username || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) return null;
    return session;
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader, name = SESSION_COOKIE) {
  const item = String(cookieHeader || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}


const SESSION_COOKIE = 'tbm_planner_session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function base64UrlEncode(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return new Uint8Array([...binary].map(character => character.charCodeAt(0)));
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left ?? ''));
  const b = encoder.encode(String(right ?? ''));
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index % (a.length || 1)] || 0) ^ (b[index % (b.length || 1)] || 0);
  return mismatch === 0;
}

async function signature(payload, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

export function credentialsMatch(username, password, env) {
  return Boolean(env.TBM_APP_USER && env.TBM_APP_PASSWORD)
    && constantTimeEqual(username, env.TBM_APP_USER)
    && constantTimeEqual(password, env.TBM_APP_PASSWORD);
}

export async function createSessionToken(username, secret, now = Date.now()) {
  const payload = base64UrlEncode(JSON.stringify({ username, expiresAt: now + SESSION_TTL_SECONDS * 1000 }));
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const [payload, receivedSignature, extra] = String(token).split('.');
  if (!payload || !receivedSignature || extra) return null;
  const expectedSignature = await signature(payload, secret);
  if (!constantTimeEqual(receivedSignature, expectedSignature)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    if (!session.username || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) return null;
    return session;
  } catch {
    return null;
  }
}

export function readCookie(request, name = SESSION_COOKIE) {
  const item = String(request.headers.get('Cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

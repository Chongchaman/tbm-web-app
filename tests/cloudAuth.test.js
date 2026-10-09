import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, credentialsMatch, readCookie, sessionCookie, verifySessionToken } from '../worker/auth.js';

const env = { TBM_APP_USER: 'operator', TBM_APP_PASSWORD: 'correct-password', TBM_AUTH_SECRET: 'test-secret-with-enough-entropy' };

test('Cloudflare credentials require an exact username and password', () => {
  assert.equal(credentialsMatch('operator', 'correct-password', env), true);
  assert.equal(credentialsMatch('Operator', 'correct-password', env), false);
  assert.equal(credentialsMatch('operator', 'wrong-password', env), false);
});

test('Cloudflare session remains valid for 30 days and rejects tampering', async () => {
  const now = Date.UTC(2026, 9, 10);
  const token = await createSessionToken('operator', env.TBM_AUTH_SECRET, now);
  assert.equal((await verifySessionToken(token, env.TBM_AUTH_SECRET, now + 29 * 24 * 60 * 60 * 1000))?.username, 'operator');
  assert.equal(await verifySessionToken(token, env.TBM_AUTH_SECRET, now + 31 * 24 * 60 * 60 * 1000), null);
  assert.equal(await verifySessionToken(`${token}x`, env.TBM_AUTH_SECRET, now), null);

  const cookie = sessionCookie(token);
  const request = new Request('https://example.test', { headers: { Cookie: cookie } });
  assert.equal(readCookie(request), token);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
});

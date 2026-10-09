import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, credentialsMatch, readCookie, sessionCookie, verifySessionToken } from '../server/auth.js';

test('login credentials require an exact username and password match', () => {
  const credentials = { username: 'planner', password: 'strong-password' };
  assert.equal(credentialsMatch('planner', 'strong-password', credentials), true);
  assert.equal(credentialsMatch('Planner', 'strong-password', credentials), false);
  assert.equal(credentialsMatch('planner', 'wrong', credentials), false);
});

test('signed session is accepted before expiry and rejected after expiry', () => {
  const now = Date.UTC(2026, 9, 9);
  const token = createSessionToken({ username: 'planner', secret: 'test-secret', now });
  assert.equal(verifySessionToken(token, { secret: 'test-secret', now: now + 1000 })?.username, 'planner');
  assert.equal(verifySessionToken(token, { secret: 'test-secret', now: now + 13 * 60 * 60 * 1000 }), null);
});

test('signed session rejects tampering and can be read from its cookie', () => {
  const token = createSessionToken({ username: 'planner', secret: 'test-secret' });
  const cookie = sessionCookie(token);
  assert.equal(readCookie(cookie), token);
  assert.equal(verifySessionToken(`${token}x`, { secret: 'test-secret' }), null);
  assert.equal(verifySessionToken(token, { secret: 'another-secret' }), null);
});

import { createSessionToken, credentialsMatch, expiredSessionCookie, readCookie, sessionCookie, verifySessionToken } from './auth.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...SECURITY_HEADERS, ...headers } });
}

function methodNotAllowed() {
  return json({ error: 'Method not allowed' }, 405);
}

async function bodyJson(request) {
  try { return await request.json(); }
  catch { throw new Error('ข้อมูลที่ส่งมาไม่ถูกต้อง'); }
}

async function sessionFor(request, env) {
  return verifySessionToken(readCookie(request), env.TBM_AUTH_SECRET);
}

async function handleLogin(request, env) {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!env.TBM_APP_USER || !env.TBM_APP_PASSWORD || !env.TBM_AUTH_SECRET) return json({ error: 'ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน' }, 503);
  const { username, password } = await bodyJson(request);
  if (!credentialsMatch(String(username || '').trim(), password, env)) return json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, 401);
  const token = await createSessionToken(env.TBM_APP_USER, env.TBM_AUTH_SECRET);
  return json({ authenticated: true, user: env.TBM_APP_USER }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleSession(request, env) {
  if (request.method !== 'GET') return methodNotAllowed();
  const session = await sessionFor(request, env);
  return session ? json({ authenticated: true, user: session.username }) : json({ authenticated: false }, 401);
}

function handleLogout(request) {
  if (request.method !== 'POST') return methodNotAllowed();
  return json({ authenticated: false }, 200, { 'Set-Cookie': expiredSessionCookie() });
}

async function latestRevision(db) {
  const row = await db.prepare('SELECT COALESCE(MAX(revision), 0) AS revision FROM change_log').first();
  return Number(row?.revision || 0);
}

async function databaseInitialized(db) {
  const row = await db.prepare("SELECT value FROM metadata WHERE key = 'database_initialized'").first();
  return row?.value === '1';
}

async function handleSnapshot(request, env) {
  if (request.method !== 'GET') return methodNotAllowed();
  const url = new URL(request.url);
  const after = Math.max(0, Number(url.searchParams.get('after') || 0) || 0);
  const [revision, initialized] = await Promise.all([latestRevision(env.DB), databaseInitialized(env.DB)]);
  if (after > 0 && after === revision) return json({ changed: false, initialized, revision });

  const [recordResult, stateResult] = await Promise.all([
    env.DB.prepare('SELECT payload FROM records ORDER BY track, ring_number, record_type').all(),
    env.DB.prepare('SELECT key, value FROM project_state ORDER BY key').all(),
  ]);
  const records = recordResult.results.flatMap(row => {
    try { return [JSON.parse(row.payload)]; } catch { return []; }
  });
  const state = Object.fromEntries(stateResult.results.map(row => [row.key, row.value]));
  return json({ changed: true, initialized, revision, records, state });
}

function cleanRecord(change) {
  const record = change?.record;
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('ข้อมูลริงไม่ถูกต้อง');
  const id = String(change.id || '').trim();
  const track = record.track === 'WB' ? 'WB' : 'EB';
  const ringNumber = Number(record.ringNumber ?? String(record.ringNum || '').replace(/\D/g, ''));
  const recordType = String(record.recordType || 'planned').trim();
  if (!id || !Number.isFinite(ringNumber) || ringNumber < 0 || !recordType) throw new Error('ข้อมูลริงไม่ครบ');
  return { id, track, ringNumber, recordType, payload: JSON.stringify({ ...record, track }) };
}

async function handleSync(request, env) {
  if (request.method !== 'POST') return methodNotAllowed();
  const payload = await bodyJson(request);
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  if (!changes.length) return json({ applied: 0, revision: await latestRevision(env.DB) });
  if (changes.length > 200) return json({ error: 'ส่งข้อมูลได้ไม่เกินครั้งละ 200 รายการ' }, 413);

  const now = new Date().toISOString();
  const statements = [];
  for (const change of changes) {
    if (change.kind === 'record' && change.operation === 'delete') {
      const id = String(change.id || '').trim();
      if (!id) throw new Error('ไม่พบรหัสรายการที่จะลบ');
      statements.push(env.DB.prepare('DELETE FROM records WHERE id = ?').bind(id));
      statements.push(env.DB.prepare("INSERT INTO change_log (entity_type, entity_id, operation, track, changed_at) VALUES ('record', ?, 'delete', ?, ?)").bind(id, change.track === 'WB' ? 'WB' : 'EB', now));
    } else if (change.kind === 'record') {
      const record = cleanRecord(change);
      statements.push(env.DB.prepare('INSERT INTO records (id, track, ring_number, record_type, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET track = excluded.track, ring_number = excluded.ring_number, record_type = excluded.record_type, payload = excluded.payload, updated_at = excluded.updated_at').bind(record.id, record.track, record.ringNumber, record.recordType, record.payload, now));
      statements.push(env.DB.prepare("INSERT INTO change_log (entity_type, entity_id, operation, track, changed_at) VALUES ('record', ?, 'upsert', ?, ?)").bind(record.id, record.track, now));
    } else if (change.kind === 'state') {
      const key = String(change.key || '').trim();
      if (!key || typeof change.value !== 'string') throw new Error('ข้อมูลตั้งค่าไม่ถูกต้อง');
      statements.push(env.DB.prepare('INSERT INTO project_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(key, change.value, now));
      statements.push(env.DB.prepare("INSERT INTO change_log (entity_type, entity_id, operation, changed_at) VALUES ('state', ?, 'upsert', ?)").bind(key, now));
    } else throw new Error('ชนิดการเปลี่ยนแปลงไม่ถูกต้อง');
  }
  statements.push(env.DB.prepare("INSERT INTO metadata (key, value, updated_at) VALUES ('database_initialized', '1', ?) ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = excluded.updated_at").bind(now));
  await env.DB.batch(statements);
  return json({ applied: changes.length, revision: await latestRevision(env.DB) });
}

async function handleApi(request, env) {
  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/auth/login') return handleLogin(request, env);
    if (path === '/api/auth/logout') return handleLogout(request);
    if (path === '/api/auth/session') return handleSession(request, env);
    const session = await sessionFor(request, env);
    if (!session) return json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, 401);
    if (path === '/api/data/snapshot') return handleSnapshot(request, env);
    if (path === '/api/data/sync') return handleSync(request, env);
    if (path === '/api/health') return json({ ok: true, database: 'D1' });
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('API error', { path, message: error instanceof Error ? error.message : String(error) });
    return json({ error: error instanceof Error ? error.message : 'ระบบฐานข้อมูลขัดข้อง' }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

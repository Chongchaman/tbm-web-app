import { recordIdentity } from './recordIdentity.js';

const PENDING_RECORDS_KEY = 'tbm_cloud_pending_records';
const PENDING_STATE_KEY = 'tbm_cloud_pending_state';
const MIGRATED_KEY = 'tbm_cloud_migrated';
const REVISION_KEY = 'tbm_cloud_revision';
const SYNC_CHANNEL = 'tbm-cloudflare-live';
export const PROJECT_KEYS = [
  'tbm_appearance', 'tbm_theme', 'tbm_ui_font', 'tbm_ui_size', 'tbm_density',
  'tbm_horizontal_alignment', 'tbm_vertical_alignment',
  'tbm_horizontal_alignment_EB', 'tbm_horizontal_alignment_WB',
  'tbm_vertical_alignment_EB', 'tbm_vertical_alignment_WB', 'tbm_gap_settings',
  'tbm_advance_track', 'tbm_advance_session_EB', 'tbm_advance_session_WB',
  'tbm_single_session_EB', 'tbm_single_session_WB', 'tbm_single_types_EB',
  'tbm_single_types_WB', 'tbm_sequence_session_EB', 'tbm_sequence_session_WB',
  'tbm_sequence_types_EB', 'tbm_sequence_types_WB', 'tbm_soil_levels',
  'tbm_soil_level_stations',
];

let stateTimer;
let connected = import.meta.env.PROD;
const liveChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new window.BroadcastChannel(SYNC_CHANNEL) : null;

function storageRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function revisionRead() {
  try { return Math.max(0, Number(sessionStorage.getItem(REVISION_KEY) || 0) || 0); } catch { return 0; }
}

function revisionWrite(value) {
  try { sessionStorage.setItem(REVISION_KEY, String(Math.max(0, Number(value) || 0))); } catch { /* session storage can be unavailable */ }
}

async function apiRequest(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { connected = false; throw new Error('ติดต่อฐานข้อมูล Cloudflare ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'); }
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) window.location.reload();
  if (!response.ok) { connected = false; throw new Error(result.error || `Cloudflare ตอบกลับ ${response.status}`); }
  connected = true;
  return result;
}

export function isCloudConnected() { return connected; }

export async function connectCloud() {
  await apiRequest('GET', '/api/health');
  return true;
}

function pendingRecordsRead() { return storageRead(PENDING_RECORDS_KEY, {}); }
function pendingStateRead() { return storageRead(PENDING_STATE_KEY, {}); }
export function pendingCount() { return Object.keys(pendingRecordsRead()).length + Object.keys(pendingStateRead()).length; }
export function isCloudMigrated() { return localStorage.getItem(MIGRATED_KEY) === '1'; }
export function markCloudMigrated() { localStorage.setItem(MIGRATED_KEY, '1'); }

export function setProjectItem(key, value) {
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, value);
  if (previous === value || !PROJECT_KEYS.includes(key) || !isCloudMigrated()) return;
  const pending = pendingStateRead();
  pending[key] = { value, queuedAt: new Date().toISOString() };
  localStorage.setItem(PENDING_STATE_KEY, JSON.stringify(pending));
  if (connected) {
    clearTimeout(stateTimer);
    stateTimer = setTimeout(() => { flushPendingProjectState().catch(() => {}); }, 120);
  }
}

export function queueRecordChanges(records, operation) {
  const pending = pendingRecordsRead();
  for (const record of records) {
    const id = recordIdentity(record);
    pending[id] = { operation, record, queuedAt: new Date().toISOString() };
  }
  localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(pending));
  liveChannel?.postMessage({ type: 'records', operation, records, sentAt: Date.now() });
}

export function subscribeRecordChanges(handler) {
  if (typeof window === 'undefined') return () => {};
  const receive = event => { if (event.data?.type === 'records') handler(event.data); };
  liveChannel?.addEventListener('message', receive);
  return () => liveChannel?.removeEventListener('message', receive);
}

function clearPendingRecords(entries) {
  const pending = pendingRecordsRead();
  for (const [id, item] of entries) if (pending[id]?.queuedAt === item.queuedAt) delete pending[id];
  localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(pending));
}

export async function flushPendingRecords() {
  const entries = Object.entries(pendingRecordsRead());
  if (!entries.length) return 0;
  let completed = 0;
  for (let offset = 0; offset < entries.length; offset += 100) {
    const batch = entries.slice(offset, offset + 100);
    const changes = batch.map(([id, item]) => ({
      kind: 'record', operation: item.operation === 'delete' ? 'delete' : 'upsert', id,
      track: item.record?.track === 'WB' ? 'WB' : 'EB', record: item.operation === 'delete' ? undefined : item.record,
    }));
    const result = await apiRequest('POST', '/api/data/sync', { changes });
    revisionWrite(result.revision);
    clearPendingRecords(batch);
    completed += batch.length;
  }
  return completed;
}

export function captureProjectState() {
  const state = {};
  for (const key of PROJECT_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) state[key] = value;
  }
  return state;
}

export async function uploadProjectState(keys = PROJECT_KEYS) {
  const state = captureProjectState();
  const pending = pendingStateRead();
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(state)) if (keys.includes(key)) pending[key] = { value, queuedAt: now };
  localStorage.setItem(PENDING_STATE_KEY, JSON.stringify(pending));
  markCloudMigrated();
  return flushPendingProjectState();
}

export async function flushPendingProjectState() {
  const entries = Object.entries(pendingStateRead());
  if (!entries.length) return 0;
  let completed = 0;
  for (let offset = 0; offset < entries.length; offset += 100) {
    const batch = entries.slice(offset, offset + 100);
    const result = await apiRequest('POST', '/api/data/sync', { changes: batch.map(([key, item]) => ({ kind: 'state', operation: 'upsert', key, value: item.value })) });
    revisionWrite(result.revision);
    const current = pendingStateRead();
    for (const [key, item] of batch) if (current[key]?.queuedAt === item.queuedAt) delete current[key];
    localStorage.setItem(PENDING_STATE_KEY, JSON.stringify(current));
    completed += batch.length;
  }
  return completed;
}

export async function fetchCloudSnapshot({ force = false } = {}) {
  const after = force ? 0 : revisionRead();
  const result = await apiRequest('GET', `/api/data/snapshot?after=${after}`);
  revisionWrite(result.revision);
  return result;
}

export function restoreProjectState(state) {
  localStorage.setItem('tbm_cloud_before_pull', JSON.stringify({ savedAt: new Date().toISOString(), state: captureProjectState() }));
  for (const [key, value] of Object.entries(state || {})) if (PROJECT_KEYS.includes(key) && typeof value === 'string') localStorage.setItem(key, value);
  markCloudMigrated();
}

import { recordIdentity } from './recordIdentity.js';
import { recordKind, ringNumber } from './decisionSupport.js';

const CONFIG_KEY = 'tbm_google_sheets_config';
const PENDING_KEY = 'tbm_google_sheets_pending';
const PENDING_STATE_KEY = 'tbm_google_sheets_pending_state';
const MIGRATED_KEY = 'tbm_google_sheets_migrated';
// Public OAuth Web Client ID. The browser token flow does not use a client secret.
const DEFAULT_CLIENT_ID = '241587010481-t2ect3k7r78da75c3irnr8cdthc2pj41.apps.googleusercontent.com';
const DEFAULT_SHEETS = {
  EB: '1dyc2SDKhpUyxHdVFDx2RHTcdIbwEgX3hPkwR8v4amB8',
  WB: '1gTafcYxS_DFSDbxj56ypzvExAhhL3TdhOylGeRgjLdI',
};
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SYNC_CHANNEL = 'tbm-google-sheets-live';
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

let accessToken = '';
let gisPromise;
let stateTimer;
const recordsSheetIds = new Map();
const liveChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new window.BroadcastChannel(SYNC_CHANNEL) : null;

function storageRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function getSheetsConfig() {
  const saved = storageRead(CONFIG_KEY, {});
  return {
    clientId: saved.clientId || import.meta.env?.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID,
    sheetIdEB: saved.sheetIdEB || saved.sheetId || import.meta.env?.VITE_GOOGLE_SHEET_ID_EB || DEFAULT_SHEETS.EB,
    sheetIdWB: saved.sheetIdWB || import.meta.env?.VITE_GOOGLE_SHEET_ID_WB || DEFAULT_SHEETS.WB,
  };
}

export function saveSheetsConfig(config) {
  const clientId = String(config.clientId || '').trim();
  const sheetIdEB = parseSheetId(config.sheetIdEB);
  const sheetIdWB = parseSheetId(config.sheetIdWB);
  if (!clientId) throw new Error('ยังไม่ได้ตั้งค่า OAuth Client ID กรุณาสร้าง Client ID ประเภท Web application ใน Google Cloud ก่อน');
  if (!clientId.endsWith('.apps.googleusercontent.com')) throw new Error('ค่านี้ไม่ใช่ OAuth Client ID ประเภท Web application กรุณาคัดลอก Client ID ที่ลงท้ายด้วย .apps.googleusercontent.com (ไม่ใช่ API key หรือ Client secret)');
  if (!sheetIdEB || !sheetIdWB) throw new Error('กรุณาใส่ลิงก์หรือ ID ของทั้งสอง Google Sheet');
  if (sheetIdEB === sheetIdWB) throw new Error('TBM1 และ TBM2 ต้องใช้ Google Sheet คนละไฟล์');
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ clientId, sheetIdEB, sheetIdWB }));
  accessToken = '';
  return { clientId, sheetIdEB, sheetIdWB };
}

export function parseSheetId(input) {
  const value = String(input || '').trim();
  const match = value.match(/\/spreadsheets\/d\/([\w-]+)/);
  return match ? match[1] : (/^[\w-]{20,}$/.test(value) ? value : '');
}

export function isSheetsConnected() { return Boolean(accessToken); }

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { gisPromise = undefined; reject(new Error('โหลด Google Sign-In ไม่สำเร็จ')); };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export async function connectSheets(config = getSheetsConfig()) {
  if (!config.clientId || !config.sheetIdEB || !config.sheetIdWB) throw new Error('กรุณาตั้งค่า OAuth Client ID และ Google Sheet ทั้งสองก่อน');
  await loadGIS();
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SCOPE,
      callback: response => response.error ? reject(new Error(response.error_description || response.error)) : resolve(response.access_token),
      error_callback: response => reject(new Error(response.type === 'popup_closed' ? 'ปิดหน้าต่างลงชื่อเข้าใช้' : 'Google Sign-In ไม่สำเร็จ')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
  accessToken = token;
  try { await Promise.all([config.sheetIdEB, config.sheetIdWB].map(id => sheetsRequest('GET', `/${encodeURIComponent(id)}?fields=properties.title,sheets.properties.title`))); }
  catch (error) { accessToken = ''; throw error; }
  return true;
}

export function disconnectSheets() {
  const token = accessToken;
  accessToken = '';
  if (token && window.google?.accounts?.oauth2?.revoke) window.google.accounts.oauth2.revoke(token, () => {});
}

async function sheetsRequest(method, path, body) {
  if (!accessToken) throw new Error('กรุณาลงชื่อเข้าใช้ Google ก่อน');
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new Error('ติดต่อ Google Sheets ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'); }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) accessToken = '';
    throw new Error(result.error?.message || `Google Sheets ตอบกลับ ${response.status}`);
  }
  return response.json().catch(() => ({}));
}

function rangePath(sheetId, range) {
  return `/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}`;
}

function sheetIdFor(track) {
  const config = getSheetsConfig();
  return track === 'WB' ? config.sheetIdWB : config.sheetIdEB;
}

export function sheetForProjectKey(key) {
  if (key.endsWith('_WB')) return ['WB'];
  if (key.endsWith('_EB')) return ['EB'];
  if (key === 'tbm_horizontal_alignment' || key === 'tbm_vertical_alignment') return ['EB', 'WB'];
  return ['EB', 'WB'];
}

const TRACK_OBJECT_KEYS = ['tbm_soil_levels', 'tbm_soil_level_stations'];
function trackValue(key, value, track) {
  if (!TRACK_OBJECT_KEYS.includes(key)) return value;
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify({ [track]: parsed?.[track] ?? null });
  } catch { return value; }
}

function pendingRead() { return storageRead(PENDING_KEY, {}); }
function pendingStateRead() { return storageRead(PENDING_STATE_KEY, {}); }
export function pendingCount() { return Object.keys(pendingRead()).length + Object.keys(pendingStateRead()).length; }

export function setProjectItem(key, value) {
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, value);
  if (previous === value || !PROJECT_KEYS.includes(key) || localStorage.getItem(MIGRATED_KEY) !== '1') return;
  const pending = pendingStateRead();
  pending[key] = new Date().toISOString();
  localStorage.setItem(PENDING_STATE_KEY, JSON.stringify(pending));
  if (accessToken) {
    clearTimeout(stateTimer);
    stateTimer = setTimeout(() => { flushPendingProjectState().catch(() => {}); }, 120);
  }
}

export function queueRecordChanges(records, operation) {
  const pending = pendingRead();
  for (const record of records) {
    const id = recordIdentity(record);
    pending[id] = { operation, record, queuedAt: new Date().toISOString() };
  }
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  liveChannel?.postMessage({ type:'records', operation, records, sentAt:Date.now() });
}

export function subscribeRecordChanges(handler) {
  if (typeof window === 'undefined') return () => {};
  const receive = event => { if (event.data?.type === 'records') handler(event.data); };
  liveChannel?.addEventListener('message', receive);
  return () => liveChannel?.removeEventListener('message', receive);
}

function clearPending(entries) {
  const pending = pendingRead();
  for (const [id, item] of entries) if (pending[id]?.queuedAt === item.queuedAt) delete pending[id];
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function recordRow(record, deletedAt = '') {
  return [
    recordIdentity(record), record.track || '', ringNumber(record), recordKind(record),
    record.sta ?? record.STA ?? '', record.timestamp || record.recordedAt || '',
    new Date().toISOString(), JSON.stringify(record), deletedAt,
  ];
}

export function parseRecordRows(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    if (!row[0]) continue;
    const previous = byId.get(row[0]);
    if (!previous || String(row[6] || '') >= String(previous[6] || '')) byId.set(row[0], row);
  }
  return [...byId.values()].filter(row => !row[8]).flatMap(row => {
    try { return [JSON.parse(row[7])]; } catch { return []; }
  });
}

export function parseRecordSnapshot(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    if (!row[0]) continue;
    const previous = byId.get(row[0]);
    if (!previous || String(row[6] || '') >= String(previous[6] || '')) byId.set(row[0], row);
  }
  return {
    records: parseRecordRows([...byId.values()]),
    deletedIds: [...byId.values()].filter(row => Boolean(row[8])).map(row => row[0]),
  };
}

export async function fetchSheetSnapshot() {
  const results = await Promise.all(['EB', 'WB'].map(track => sheetsRequest('GET', rangePath(sheetIdFor(track), 'Records!A2:I'))));
  const snapshots = results.map(result => parseRecordSnapshot(result.values));
  return { records: snapshots.flatMap(snapshot => snapshot.records), deletedIds: snapshots.flatMap(snapshot => snapshot.deletedIds) };
}

export async function flushPendingRecords() {
  const entries = Object.entries(pendingRead());
  if (!entries.length) return 0;
  const groups = ['EB', 'WB'].map(track => entries.filter(([, item]) => (item.record.track || 'EB') === track));
  const results = await Promise.allSettled(groups.map((group, index) => group.length ? flushRecordGroup(index ? 'WB' : 'EB', group) : Promise.resolve(0)));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results.reduce((total, result) => total + result.value, 0);
}

async function flushRecordGroup(track, entries) {
  const sheetId = sheetIdFor(track);
  const deletes = entries.filter(([, item]) => item.operation === 'delete');
  const saves = entries.filter(([, item]) => item.operation !== 'delete');
  if (deletes.length) {
    const result = await sheetsRequest('GET', rangePath(sheetId, 'Records!A2:A'));
    const deleteIds = new Set(deletes.map(([id]) => id));
    const rowIndexes = (result.values || []).flatMap((row, index) => deleteIds.has(row[0]) ? [index + 1] : []).sort((a, b) => b - a);
    if (rowIndexes.length) {
      const numericSheetId = await recordsSheetId(sheetId);
      await sheetsRequest('POST', `/${encodeURIComponent(sheetId)}:batchUpdate`, { requests: rowIndexes.map(rowIndex => ({
        deleteDimension: { range: { sheetId: numericSheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } },
      })) });
    }
    clearPending(deletes);
  }
  if (!saves.length) return entries.length;
  const result = await sheetsRequest('GET', rangePath(sheetId, 'Records!A2:A'));
  const existing = new Map((result.values || []).map((row, index) => [row[0], index + 2]));
  const updates = [];
  const appends = [];
  for (const [id, item] of saves) {
    const row = recordRow(item.record);
    if (existing.has(id)) updates.push({ range: `Records!A${existing.get(id)}:I${existing.get(id)}`, values: [row] });
    else appends.push(row);
  }
  if (updates.length) await sheetsRequest('POST', `/${encodeURIComponent(sheetId)}/values:batchUpdate`, { valueInputOption: 'RAW', data: updates });
  if (appends.length) await sheetsRequest('POST', `${rangePath(sheetId, 'Records!A:I')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: appends });
  clearPending(saves);
  return entries.length;
}

async function recordsSheetId(spreadsheetId) {
  if (recordsSheetIds.has(spreadsheetId)) return recordsSheetIds.get(spreadsheetId);
  const result = await sheetsRequest('GET', `/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(sheetId,title)`);
  const sheet = result.sheets?.find(item => item.properties?.title === 'Records');
  if (!sheet) throw new Error('ไม่พบแท็บ Records ใน Google Sheet');
  recordsSheetIds.set(spreadsheetId, sheet.properties.sheetId);
  return sheet.properties.sheetId;
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
  await Promise.all(['EB', 'WB'].map(track => uploadProjectStateForTrack(track, state, keys)));
  if (keys === PROJECT_KEYS) {
    localStorage.setItem(MIGRATED_KEY, '1');
    localStorage.removeItem(PENDING_STATE_KEY);
  }
}

async function uploadProjectStateForTrack(track, state, keys) {
  const sheetId = sheetIdFor(track);
  const result = await sheetsRequest('GET', rangePath(sheetId, 'AppState!A2:A'));
  const existing = new Map((result.values || []).map((row, index) => [row[0], index + 2]));
  const updates = [];
  const appends = [];
  for (const [key, value] of Object.entries(state)) {
    if (!keys.includes(key) || !sheetForProjectKey(key).includes(track)) continue;
    const row = [key, new Date().toISOString(), trackValue(key, value, track)];
    if (existing.has(key)) updates.push({ range: `AppState!A${existing.get(key)}:C${existing.get(key)}`, values: [row] });
    else appends.push(row);
  }
  if (updates.length) await sheetsRequest('POST', `/${encodeURIComponent(sheetId)}/values:batchUpdate`, { valueInputOption: 'RAW', data: updates });
  if (appends.length) await sheetsRequest('POST', `${rangePath(sheetId, 'AppState!A:C')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: appends });
}

export async function flushPendingProjectState() {
  const pending = pendingStateRead();
  const keys = Object.keys(pending);
  if (!keys.length) return 0;
  await uploadProjectState(keys);
  const current = pendingStateRead();
  for (const key of keys) if (current[key] === pending[key]) delete current[key];
  localStorage.setItem(PENDING_STATE_KEY, JSON.stringify(current));
  return keys.length;
}

export async function fetchProjectState() {
  const results = await Promise.all(['EB', 'WB'].map(track => sheetsRequest('GET', rangePath(sheetIdFor(track), 'AppState!A2:C'))));
  const [eb, wb] = results.map((result, index) => parseProjectStateRows(result.values, index ? 'WB' : 'EB'));
  const state = { ...eb, ...wb };
  for (const key of TRACK_OBJECT_KEYS) {
    if (!eb[key] && !wb[key]) continue;
    try { state[key] = JSON.stringify({ ...JSON.parse(eb[key] || '{}'), ...JSON.parse(wb[key] || '{}') }); }
    catch { state[key] = eb[key] || wb[key]; }
  }
  return Object.keys(state).length ? state : null;
}

function parseProjectStateRows(rowsInput, track) {
  const rows = rowsInput || [];
  const legacy = rows.find(row => row[0] === 'project_state');
  if (legacy) {
    const state = JSON.parse(legacy[2]);
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('ข้อมูลตั้งค่าในชีตไม่ถูกต้อง');
    return Object.fromEntries(PROJECT_KEYS.filter(key => typeof state[key] === 'string' && (track === 'EB' || sheetForProjectKey(key).length === 1 || TRACK_OBJECT_KEYS.includes(key))).map(key => [key, state[key]]));
  }
  return Object.fromEntries(rows.filter(row => PROJECT_KEYS.includes(row[0]) && typeof row[2] === 'string' && (track === 'EB' || sheetForProjectKey(row[0]).length === 1 || TRACK_OBJECT_KEYS.includes(row[0]))).map(row => [row[0], row[2]]));
}

export function restoreProjectState(state) {
  localStorage.setItem('tbm_sheet_before_pull', JSON.stringify({ savedAt: new Date().toISOString(), state: captureProjectState() }));
  for (const [key, value] of Object.entries(state || {})) if (PROJECT_KEYS.includes(key)) localStorage.setItem(key, value);
  localStorage.setItem(MIGRATED_KEY, '1');
}

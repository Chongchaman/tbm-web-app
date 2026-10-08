import test from 'node:test';
import assert from 'node:assert/strict';
import { connectSheets, disconnectSheets, flushPendingRecords, getSheetsConfig, parseRecordSnapshot, pendingCount, queueRecordChanges, recordRow, saveSheetsConfig, sheetForProjectKey, uploadProjectState } from '../src/services/googleSheetsService.js';
import { recordIdentity } from '../src/services/recordIdentity.js';

test('equal ring numbers on TBM1 and TBM2 remain separate records', () => {
  const eb = { ringNum: 'R0042', recordType: 'planned', track: 'EB', key: 'R5' };
  const wb = { ringNum: 'R0042', recordType: 'planned', track: 'WB', key: 'L5' };
  assert.notEqual(recordIdentity(eb), recordIdentity(wb));
  assert.deepEqual(parseRecordSnapshot([recordRow(eb), recordRow(wb)]).records, [eb, wb]);
});

test('latest tombstone removes a deleted record from a pulled sheet', () => {
  const ring = { ringNum: 'R0007', recordType: 'measured', track: 'WB', key: 'L2' };
  const saved = recordRow(ring);
  saved[6] = '2026-10-09T00:00:00.000Z';
  const deleted = [...saved];
  deleted[6] = '2026-10-09T00:01:00.000Z';
  deleted[8] = deleted[6];
  const snapshot = parseRecordSnapshot([saved, deleted]);
  assert.deepEqual(snapshot.records, []);
  assert.deepEqual(snapshot.deletedIds, [recordIdentity(ring)]);
});

test('per-machine planning state routes only to its machine sheet', () => {
  assert.deepEqual(sheetForProjectKey('tbm_advance_session_EB'), ['EB']);
  assert.deepEqual(sheetForProjectKey('tbm_horizontal_alignment_WB'), ['WB']);
  assert.deepEqual(sheetForProjectKey('tbm_appearance'), ['EB', 'WB']);
});

test('Google Sheets sync batches writes to the correct machine files', async () => {
  const original = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const values = new Map();
  const calls = [];
  let deleting = false;
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  globalThis.window = { google: { accounts: { oauth2: {
    initTokenClient: options => ({ requestAccessToken: () => options.callback({ access_token: 'test-token' }) }),
    revoke: (_token, callback) => callback(),
  } } } };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (deleting && url.includes('Records!A2%3AA')) return new Response(JSON.stringify({ values: [['planned:EB:1']] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (deleting && url.includes('fields=sheets.properties')) return new Response(JSON.stringify({ sheets: [{ properties: { sheetId: 123, title: 'Records' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ values: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const config = saveSheetsConfig({ clientId: 'test.apps.googleusercontent.com', sheetIdEB: '1dyc2SDKhpUyxHdVFDx2RHTcdIbwEgX3hPkwR8v4amB8', sheetIdWB: '1gTafcYxS_DFSDbxj56ypzvExAhhL3TdhOylGeRgjLdI' });
    assert.deepEqual(getSheetsConfig(), config);
    await connectSheets(config);
    queueRecordChanges([
      { ringNum: 'R0001', recordType: 'planned', track: 'EB', key: 'R2' },
      { ringNum: 'R0001', recordType: 'planned', track: 'WB', key: 'L2' },
    ], 'save');
    assert.equal(await flushPendingRecords(), 2);
    assert.equal(pendingCount(), 0);
    const appends = calls.filter(call => call.url.includes(':append'));
    assert.equal(appends.length, 2);
    assert.ok(appends.some(call => call.url.includes(config.sheetIdEB) && JSON.parse(call.options.body).values[0][0] === 'planned:EB:1'));
    assert.ok(appends.some(call => call.url.includes(config.sheetIdWB) && JSON.parse(call.options.body).values[0][0] === 'planned:WB:1'));
    for (const call of appends) assert.equal(call.options.headers.Authorization, 'Bearer test-token');
    values.set('tbm_advance_session_EB', '{"key":"R2"}');
    values.set('tbm_advance_session_WB', '{"key":"L2"}');
    values.set('tbm_soil_levels', '{"EB":42,"WB":38}');
    await uploadProjectState();
    const stateAppends = calls.filter(call => call.url.includes('AppState') && call.url.includes(':append'));
    assert.equal(stateAppends.length, 2);
    const eb = JSON.parse(stateAppends.find(call => call.url.includes(config.sheetIdEB)).options.body).values;
    const wb = JSON.parse(stateAppends.find(call => call.url.includes(config.sheetIdWB)).options.body).values;
    assert.ok(eb.some(row => row[0] === 'tbm_advance_session_EB'));
    assert.ok(!eb.some(row => row[0] === 'tbm_advance_session_WB'));
    assert.ok(wb.some(row => row[0] === 'tbm_advance_session_WB'));
    assert.equal(JSON.parse(wb.find(row => row[0] === 'tbm_soil_levels')[2]).WB, 38);
    deleting = true;
    queueRecordChanges([{ ringNum: 'R0001', recordType: 'planned', track: 'EB', key: 'R2' }], 'delete');
    assert.equal(await flushPendingRecords(), 1);
    const physicalDelete = calls.find(call => call.url.includes(`${config.sheetIdEB}:batchUpdate`) && JSON.parse(call.options.body).requests?.[0]?.deleteDimension);
    assert.equal(JSON.parse(physicalDelete.options.body).requests[0].deleteDimension.range.sheetId, 123);
    assert.deepEqual(JSON.parse(physicalDelete.options.body).requests[0].deleteDimension.range, { sheetId:123, dimension:'ROWS', startIndex:1, endIndex:2 });
    disconnectSheets();
  } finally {
    globalThis.window = original.window;
    globalThis.localStorage = original.localStorage;
    globalThis.fetch = original.fetch;
  }
});

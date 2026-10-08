import test from 'node:test';
import assert from 'node:assert/strict';
import { SOIL_LIMITS, soilAt, soilColumnAt, soilProfileRange, soilSheetAt, stationMeters, tunnelElevationAt, tunnelProfileRange } from '../src/services/soilProfile.js';
import { recordIdentity } from '../src/services/recordIdentity.js';

test('Orange Line profile indexes both tunnel alignments and their terminal chainages', () => {
  assert.equal(stationMeters('20+100.000'), 20100);
  assert.equal(stationMeters('incorrect'), null);
  assert.equal(soilSheetAt('20+100', 'EB').page, 16);
  assert.equal(soilSheetAt('20+100', 'WB').page, 37);
  assert.equal(soilSheetAt('23+390.269', 'EB').page, 21);
  assert.equal(soilSheetAt('23+396.443', 'WB').page, 42);
  assert.equal(soilSheetAt('23+391', 'EB'), null);
  assert.equal(soilSheetAt('18+399.999', 'WB'), null);
  assert.deepEqual(SOIL_LIMITS.EB, { start:18400, end:23390.269, pages:'14–21' });
  assert.deepEqual(SOIL_LIMITS.WB, { start:18400, end:23396.443, pages:'35–42' });
});

test('soil view derives the tunnel level and soil section from the selected drawing range', () => {
  assert.equal(soilAt('20+100', 'EB', '').status, 'needs-elevation');
  assert.equal(soilAt('20+100', 'EB', 12.5).status, 'elevation-outside');
  const eb = tunnelElevationAt('19+100', 'EB');
  const wb = tunnelElevationAt('20+100', 'WB');
  assert.equal(eb.page, 15);
  assert.ok(eb.elevation > 70 && eb.elevation < 85);
  assert.ok(wb.elevation > 65 && wb.elevation < 80);
  assert.ok(['interpreted','boundary','unclear'].includes(soilAt('19+100', 'EB', eb.elevation).status));
  assert.equal(soilColumnAt('20+100', 'EB').length, 16);
  assert.ok(soilProfileRange('20+000', '20+500', 'EB').length >= 25);
  assert.ok(tunnelProfileRange('20+000', '20+500', 'WB').length >= 25);
});

test('ring identities are separate for EB and WB while unassigned legacy defaults to EB', () => {
  const base = { recordType:'planned', ringNum:'R0001' };
  const ids = [recordIdentity({ ...base, track:'EB' }), recordIdentity({ ...base, track:'WB' }), recordIdentity(base)];
  assert.equal(new Set(ids).size, 2);
  assert.equal(recordIdentity({ ...base, recordType:'measured', track:'EB' }), 'measured:EB:1');
  assert.equal(recordIdentity({ ...base, recordType:'measured', track:'WB' }), 'measured:WB:1');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { soilAt, soilColumnAt, soilSheetAt, stationMeters } from '../src/services/soilProfile.js';
import { recordIdentity } from '../src/services/recordIdentity.js';

test('Orange Line profile indexes both tunnel alignments and their terminal chainages', () => {
  assert.equal(stationMeters('20+100.000'), 20100);
  assert.equal(stationMeters('incorrect'), null);
  assert.equal(soilSheetAt('20+100', 'EB').page, 16);
  assert.equal(soilSheetAt('20+100', 'WB').page, 37);
  assert.equal(soilSheetAt('23+390.269', 'EB').page, 21);
  assert.equal(soilSheetAt('23+396.443', 'WB').page, 42);
  assert.equal(soilSheetAt('23+391', 'EB'), null);
  assert.equal(soilSheetAt('09+977.639', 'WB'), null);
});

test('soil reading requires verified elevation and flags ambiguity near a band edge', () => {
  assert.equal(soilAt('20+100', 'EB', '').status, 'needs-elevation');
  assert.equal(soilAt('20+100', 'EB', 12.5).status, 'elevation-outside');
  assert.equal(soilAt('20+100', 'EB', 55).soil.english, 'Stiff clay');
  assert.equal(soilAt('20+100', 'WB', 65).soil.english, 'Silty/clayey sand');
  assert.equal(soilAt('20+272.724', 'WB', 75).status, 'boundary');
  assert.equal(soilColumnAt('20+100', 'EB').length, 16);
});

test('planned rings with the same number retain separate EB and WB identities', () => {
  const base = { recordType:'planned', ringNum:'R0001' };
  const ids = [recordIdentity({ ...base, track:'EB' }), recordIdentity({ ...base, track:'WB' }), recordIdentity(base)];
  assert.equal(new Set(ids).size, 3);
  assert.equal(recordIdentity({ ...base, recordType:'measured', track:'EB' }), 'measured:1');
});

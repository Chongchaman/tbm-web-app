import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlignmentPosition } from '../src/services/alignmentPosition.js';
import { DEFAULT_ALIGNMENT_SECTIONS, DEFAULT_VERTICAL_ALIGNMENT } from '../src/services/advancePlanner.js';
import { soilLevelAtStation } from '../src/services/soilProfile.js';
import { tbmMode } from '../src/services/tbmMode.js';

const input = (overrides={}) => ({ sections:DEFAULT_ALIGNMENT_SECTIONS,
  vertical:DEFAULT_VERTICAL_ALIGNMENT,currentSTA:'20+180.000',
  recovery:{startDeviationH:50,startDeviationV:20,startHeadingErrorDeg:0,startPitchErrorDeg:0,initialStateConfirmed:true},
  ...overrides });

test('current TBM position follows entered chainage, horizontal curve and vertical profile', () => {
  const result=buildAlignmentPosition(input());
  assert.deepEqual(result.errors,[]);
  assert.ok(Math.abs(result.currentDistance-92.724)<0.001);
  assert.ok(result.points.at(-1).x>0);
  assert.ok(result.current.elevation>11 && result.current.elevation<12);
  assert.ok(Math.abs((result.tbm.elevation-result.current.elevation)-.02)<1e-9);
  assert.ok(Math.abs((result.tbm.x-result.current.x)*Math.cos(result.current.heading)
    -(result.tbm.y-result.current.y)*Math.sin(result.current.heading)-.05)<1e-9);
  assert.equal(result.confirmed,true);
});

test('changing the entered radius changes the drawn route without changing STA position', () => {
  const first=buildAlignmentPosition(input());
  const changed=buildAlignmentPosition(input({sections:DEFAULT_ALIGNMENT_SECTIONS.map((section,index)=>index===0?{...section,radius:300}:section)}));
  assert.deepEqual(changed.errors,[]);
  assert.equal(changed.current.sta,first.current.sta);
  assert.notEqual(changed.points.at(-1).x,first.points.at(-1).x);
  assert.ok(buildAlignmentPosition(input({currentSTA:'20+500'})).errors.length);
});

test('visual stationing also works when the tunnel advances toward higher chainage', () => {
  const section={...DEFAULT_ALIGNMENT_SECTIONS[0],code:'UP',sectionType:'tangent',direction:'straight',startSTA:'10+000',endSTA:'10+100'};
  const vertical={...DEFAULT_VERTICAL_ALIGNMENT[0],code:'VUP',curveType:'constant_grade',startSTA:'10+000',endSTA:'10+100',startElev:50,endElev:49};
  const result=buildAlignmentPosition(input({sections:[section],vertical:[vertical],currentSTA:'10+050'}));
  assert.deepEqual(result.errors,[]);
  assert.equal(result.currentDistance,50);
  assert.equal(result.current.sta,10050);
  assert.equal(result.current.elevation,49.5);
  assert.ok(Math.abs(result.points.at(-1).x)<1e-9);
});

test('TBM mapping and soil level stay tied to their tunnel and station', () => {
  assert.equal(tbmMode('EB').machine,'TBM1');
  assert.equal(tbmMode('WB').machine,'TBM2');
  const levels={EB:'55',WB:'75'},stations={EB:'20+180',WB:'20+100'};
  assert.equal(soilLevelAtStation(levels,stations,'EB','20+180.000'),'55');
  assert.equal(soilLevelAtStation(levels,stations,'WB','20+180'),'');
  assert.equal(soilLevelAtStation(levels,stations,'EB','20+181'),'');
});

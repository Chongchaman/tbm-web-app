import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePressureWindow, makePressureSections, pressureState, sectionAtStation, toBar } from '../src/services/pressureControl.js';
import { groundElevationAt } from '../src/services/soilProfile.js';

test('calculates face equilibrium from effective stress and pore pressure', () => {
  const result=calculatePressureWindow({groundRL:100,axisRL:80,waterRL:98,gammaUnsat:17,gammaSat:19,k0:.7,surcharge:10,faceMargin:20,faceTolerance:15,groutMargin:20,groutTolerance:15});
  assert.equal(result.coverToAxis,20);
  assert.equal(result.porePressure,176.6);
  assert.equal(result.effectiveVertical,209.4);
  assert.equal(result.equilibriumPressure,323.2);
  assert.deepEqual(result.face,{min:328.2,target:343.2,max:358.2});
  assert.deepEqual(result.grout,{min:348.2,target:363.2,max:378.2,requestedMax:378.2,machineMaximum:null});
  assert.equal(result.groutVolume.theoretical,8.46);
  assert.equal(result.groutVolume.target,9.73);
  assert.ok(result.warnings.some(item=>item.includes('แรงดันสูงสุด')));
});

test('caps grout window and reports an incompatible machine maximum', () => {
  const result=calculatePressureWindow({groundRL:100,axisRL:80,waterRL:98,gammaUnsat:17,gammaSat:19,k0:.7,surcharge:10,faceMargin:20,faceTolerance:15,groutMargin:20,groutTolerance:15,groutMaximum:300});
  assert.equal(result.grout.min,300);
  assert.equal(result.grout.max,300);
  assert.ok(result.warnings.some(item=>item.includes('ต่ำกว่าช่วง Grout')));
});

test('pressure alarm treats the exact lower and upper limits as acceptable', () => {
  assert.equal(pressureState(100,100,130,true).level,'warning');
  assert.equal(pressureState(130,100,130,true).level,'warning');
  assert.equal(pressureState(99.9,100,130,true).level,'critical');
  assert.equal(pressureState(130.1,100,130,true).level,'critical');
  assert.equal(pressureState(115,100,130,false).level,'unknown');
});

test('builds separate pressure sections for EB and WB', () => {
  const eb=makePressureSections('EB',{});
  const wb=makePressureSections('WB',{});
  assert.equal(eb.length,8);
  assert.equal(wb.length,8);
  assert.ok(eb.every(item=>item.track==='EB'&&item.id.startsWith('EB-')));
  assert.ok(wb.every(item=>item.track==='WB'&&item.id.startsWith('WB-')));
  assert.notEqual(eb[0].values.axisRL,wb[0].values.axisRL);
  assert.ok(eb.at(-1).calculated.warnings.some(item=>item.includes('23+300')));
});

test('selects the section at a boundary station', () => {
  const sections=makePressureSections('EB',{});
  assert.equal(sectionAtStation(sections,18400).id,'EB-14');
  assert.equal(sectionAtStation(sections,23390.269).id,'EB-21');
  assert.equal(sectionAtStation(sections,17000),null);
});

test('extracts an approximate ground elevation and converts pressure units', () => {
  const ground=groundElevationAt(18750,'EB');
  assert.equal(ground.page,14);
  assert.ok(ground.elevation>90&&ground.elevation<110);
  assert.equal(toBar(250),2.5);
});

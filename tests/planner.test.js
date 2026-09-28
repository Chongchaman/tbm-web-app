import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY_DATA, NEXT_RING_TABLE, INITIAL_RING_LOGS } from '../src/data/tbmConstants.js';
import { predictGaps, assessRing, summarizeRings, validateAlignment, recordKind, finite, buildCSV } from '../src/services/decisionSupport.js';
import { evaluateCandidates } from '../src/services/smartCandidates.js';
import { runAutoPlan } from '../src/services/autoPlanner.js';
import { runAdvancePlan, computeRatioBreakdown, DEFAULT_ALIGNMENT_SECTIONS, DEFAULT_VERTICAL_ALIGNMENT, DEFAULT_GAP_SETTINGS } from '../src/services/advancePlanner.js';
import { calibrateFromRingLogs } from '../src/services/aiCalibrator.js';
import { calculateFoamConsumption, calculatePolymerConsumption, calculateCurveOffset, calculateCandidates } from '../src/services/calculator.js';
import { formatRingToDbRow, formatDbRowToRing } from '../src/services/supabaseService.js';

const normal = {hLead:0,vLead:0,gapT:50,gapB:50,gapL:50,gapR:50,suitability:'Yes'};
const section = { ...DEFAULT_ALIGNMENT_SECTIONS[0], code:'TEST', startSTA:'00+000.000', endSTA:'00+015.000', ratio:{un:1,rt:1,lt:1}, allowedTypes:['U','R','L'] };

test('zero gaps are critical, retain zero through cloud format, and optional DTA stays absent', () => {
 const record = {...normal,ringNum:'R0020',key:'R4',gapL:0,recordType:'measured',notes:'zero gap test',timestamp:'2026-09-28T00:00:00Z'};
 const row = formatRingToDbRow(record), back = formatDbRowToRing(row);
 assert.equal(back.gapL,0);assert.equal(back.deviationMm,null);assert.equal(back.recordType,'measured');assert.equal(back.notes,record.notes);
 assert.equal(assessRing(back).level,'critical');assert.equal(assessRing(back).minGap,0);
 assert.equal(predictGaps(0,0,{initialGapLeft:0}).gapL,0);
});

test('missing measurements remain unknown rather than becoming zero or DTA estimates',()=>{
 assert.equal(finite(''),false);assert.equal(finite(null),false);
 const back=formatDbRowToRing({ring_number:1,key_position:'R4',h_lead:null,v_plumb:null});
 assert.equal(back.hLead,null);assert.equal(assessRing(back).level,'unknown');
 const assessment=assessRing({...normal,hLead:54});
 assert.equal(assessment.deviationKnown,false);assert.equal(assessment.issues.some(i=>i.code==='dta'),false);
});

test('warning and critical boundaries are inclusive; DTA independently changes the plan verdict',()=>{
 assert.equal(assessRing({...normal,gapT:15}).level,'warning');
 assert.equal(assessRing({...normal,gapT:5}).level,'critical');
 assert.equal(assessRing({...normal,hLead:55,deviationMm:75}).level,'normal');
 const summary=summarizeRings([{...normal,deviationMm:76}]);assert.equal(summary.level,'critical');assert.equal(summary.dtaCount,1);
});

test('every key recommendation uses allowed transitions, actual widths, and symmetric curve demand',()=>{
 for(const key of Object.keys(KEY_DATA)) {
  const candidates=evaluateCandidates({beforeKey:key,alignmentType:'right',radius:180,lookahead:false});
  for(const c of candidates) {
   assert.ok(NEXT_RING_TABLE[key].includes(c.key));assert.equal(c.size,c.type==='U'?1200:1400);
   assert.ok(Math.abs(c.leadReq-6300*c.size/180000)<.006);
  }
 }
 const left=evaluateCandidates({beforeKey:'R13',alignmentType:'left',radius:180,lookahead:false});
 const right=evaluateCandidates({beforeKey:'R13',alignmentType:'right',radius:180,lookahead:false});
 for(const l of left)assert.equal(l.leadReq,-right.find(r=>r.key===l.key).leadReq);
});

test('sequence planner is deterministic, preserves transitions, and sums actual ring lengths',()=>{
 const input={startKey:'L2',startHLead:38.39,startVLead:32.47,ringCount:25,alignmentType:'right',radius:500};
 const plan=runAutoPlan(input);assert.deepEqual(plan,runAutoPlan(input));
 let previous=input.startKey;
 for(const ring of plan.plannedRings){assert.ok(NEXT_RING_TABLE[previous].includes(ring.key));previous=ring.key;assert.equal(ring.recordType,'planned');}
 assert.equal(plan.totalDistanceM,Number(plan.plannedRings.reduce((s,r)=>s+r.size/1000,0).toFixed(2)));
 assert.equal(plan.plannedRings.length,25);assert.ok(plan.plannedRings.some(r=>r.gapT!==90));
 for(const ringCount of [0,1.5,101,''])assert.throws(()=>runAutoPlan({...input,ringCount}));
 assert.throws(()=>runAutoPlan({...input,radius:0}));
 assert.throws(()=>runAutoPlan({...input,lookaheadDepth:'bad'}));
 assert.throws(()=>runAutoPlan({...input,allowedTypes:['X']}));
});

test('integer BOQ allocation conserves quantities without negative segment counts',()=>{
 for(let count=0;count<101;count++)for(const ratio of [{un:1,rt:1,lt:1},{un:0,rt:23,lt:13},{un:99,rt:1,lt:0}]){
  const r=computeRatioBreakdown(ratio,count);assert.equal(r.unCount+r.rtCount+r.ltCount,count);assert.ok([r.unCount,r.rtCount,r.ltCount].every(v=>Number.isInteger(v)&&v>=0));
 }
});

test('plans, samples and legacy records cannot calibrate from synthetic history',()=>{
 assert.ok(INITIAL_RING_LOGS.every(r=>recordKind(r)==='sample'));
 const records=Array.from({length:12},(_,i)=>({...normal,key:'R4',ringNum:`R${i+1}`,recordType:'planned'}));
 assert.equal(calibrateFromRingLogs([...INITIAL_RING_LOGS,...records]).sampleSize,0);
 assert.equal(calibrateFromRingLogs(records.map(r=>({...r,recordType:'measured'}))).sampleSize,12);
});

test('alignment rejects disconnected stations, forbidden ratio types and zero radius',()=>{
 assert.deepEqual(validateAlignment(DEFAULT_ALIGNMENT_SECTIONS,DEFAULT_VERTICAL_ALIGNMENT),[]);
 assert.ok(validateAlignment([{...section,radius:0}],[]).length);
 assert.ok(validateAlignment([{...section,allowedTypes:['R']}],[]).length);
 assert.ok(validateAlignment([section,{...section,code:'OTHER',startSTA:'00+020.000',endSTA:'00+030.000'}],[]).some(e=>e.includes('ไม่ต่อ')));
});

test('both alignment strategies display the same DTA propagation they score and enforce allowed keys',()=>{
 for(const strategy of ['senior_ai','ratio_guided'])for(const sectionType of ['transition_in','full_curve','transition_out','tangent']) {
  const plan=runAdvancePlan({sections:[{...section,sectionType}],verticalAlignment:[],strategy,gapSettings:DEFAULT_GAP_SETTINGS});
  assert.ok(plan.totalRings>0);let previous='U4';
  for(const ring of plan.plannedRings){assert.ok(NEXT_RING_TABLE[previous].includes(ring.selectedKey));assert.equal(ring.deviationMm,ring.predictedDeviationMm);assert.ok(Number.isFinite(ring.deviationMm));previous=ring.selectedKey;}
  assert.equal(plan.verdict.status,plan.summary.level==='critical'?'INFEASIBLE':plan.summary.level==='warning'?'WARNING':'OPTIMAL');
  assert.equal(plan.ratioDiagnostics.length,1);
 }
});

test('conditioning validates zero divisors and conserves concentration/material quantities',()=>{
 for(const override of [{jackSpeed:0},{fer:0},{atmPressure:0},{tbmDia:0},{foamDosage:101}])assert.throws(()=>calculateFoamConsumption(override));
 const slower=calculateFoamConsumption({jackSpeed:20}), faster=calculateFoamConsumption({jackSpeed:40});
 assert.equal(slower.perRing.foamAgentL,faster.perRing.foamAgentL);
 assert.ok(Math.abs(slower.flowRates.foamAgentLMin*2-faster.flowRates.foamAgentLMin)<.002);
 assert.ok(Math.abs(faster.perRing.foamAgentL+faster.perRing.waterL-faster.perRing.foamSolutionL)<.02);
 const one=calculatePolymerConsumption({distance:1}),ten=calculatePolymerConsumption({distance:10});
 assert.ok(Math.abs(one.totalConsumptionL*10-ten.totalConsumptionL)<.1);
 assert.throws(()=>calculatePolymerConsumption({polymerDosage:-1}));
});


test('CSV preserves station quotes, Thai text and multiline notes while escaping formulas',()=>{
 const text=buildCSV(['STA','Notes','Lead'],[['12"','ไทย,\nทดสอบ',-4.5],['=1+2',null,0]]);
 assert.equal(text,'\uFEFF"STA","Notes","Lead"\r\n"12""","ไทย,\nทดสอบ","-4.5"\r\n"\'=1+2","","0"');
});

test('manual compatibility API shares ranking and horizontal curves do not create vertical lead',()=>{
 const options={beforeKey:'L2',beforeHLead:38.39,beforeVLead:32.47};
 assert.deepEqual(calculateCandidates(options),evaluateCandidates(options));
 assert.equal(calculateCurveOffset(180,1200,'R').vLead,0);
 assert.equal(calculateCurveOffset(180,1200,'L').hLead,-calculateCurveOffset(180,1200,'R').hLead);
});

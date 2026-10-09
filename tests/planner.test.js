import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY_DATA, NEXT_RING_TABLE, INITIAL_RING_LOGS } from '../src/data/tbmConstants.js';
import { predictGaps, assessRing, summarizeRings, validateAlignment, recordKind, finite, buildCSV } from '../src/services/decisionSupport.js';
import { evaluateCandidates } from '../src/services/smartCandidates.js';
import { runAutoPlan } from '../src/services/autoPlanner.js';
import { runAdvancePlan, computeRatioBreakdown, DEFAULT_ALIGNMENT_SECTIONS, DEFAULT_VERTICAL_ALIGNMENT, DEFAULT_GAP_SETTINGS, normalizeGapSettings } from '../src/services/advancePlanner.js';
import { calibrateFromRingLogs } from '../src/services/aiCalibrator.js';
import { calculateFoamConsumption, calculatePolymerConsumption, calculateCurveOffset, calculateCandidates } from '../src/services/calculator.js';
import { recordRow, parseRecordRows } from '../src/services/googleSheetsService.js';
import { DEFAULT_RECOVERY, recoveryTarget, createRoute, initialRecoveryState, propagateRecovery, endpointAssessment, radians } from '../src/services/alignmentRecovery.js';
import { buildSequenceVisualPlan } from '../src/services/sequenceVisual.js';
import { STRAIGHT_ANTI_ROLL_CYCLE, straightAntiRollMeta, validateStraightAntiRollCycle } from '../src/services/straightRolling.js';

const normal = {hLead:0,vLead:0,gapT:50,gapB:50,gapL:50,gapR:50,suitability:'Yes'};
const section = { ...DEFAULT_ALIGNMENT_SECTIONS[0], code:'TEST', startSTA:'00+000.000', endSTA:'00+015.000', ratio:{un:1,rt:1,lt:1}, allowedTypes:['U','R','L'] };

test('zero gaps are critical, retain zero through Sheets format, and optional DTA stays absent', () => {
 const record = {...normal,ringNum:'R0020',key:'R4',gapL:0,recordType:'measured',notes:'zero gap test',timestamp:'2026-09-28T00:00:00Z'};
 const back = parseRecordRows([recordRow(record)])[0];
 assert.equal(back.gapL,0);assert.equal(back.deviationMm,undefined);assert.equal(back.recordType,'measured');assert.equal(back.notes,record.notes);
 assert.equal(assessRing(back).level,'critical');assert.equal(assessRing(back).minGap,0);
 assert.equal(predictGaps(0,0,{initialGapLeft:0}).gapL,0);
});

test('missing measurements remain unknown rather than becoming zero or DTA estimates',()=>{
 assert.equal(finite(''),false);assert.equal(finite(null),false);
 const back=parseRecordRows([recordRow({ringNum:'R0001',key:'R4',recordType:'measured',hLead:null,vLead:null})])[0];
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

test('single-ring type switches constrain current keys and lookahead without changing the installed predecessor',()=>{
 for(const beforeKey of Object.keys(KEY_DATA)) for(const allowedTypes of [[],['U'],['R'],['L'],['U','R'],['U','L'],['R','L'],['U','R','L']]) {
  const candidates=evaluateCandidates({beforeKey,allowedTypes,beforeHLead:12,beforeVLead:-8});
  const expectedKeys=NEXT_RING_TABLE[beforeKey].filter(key=>allowedTypes.includes(KEY_DATA[key].type));
  assert.deepEqual(candidates.map(candidate=>candidate.key).sort(),expectedKeys.sort());
  for(const candidate of candidates) {
   const next=evaluateCandidates({beforeKey:candidate.key,beforeHLead:candidate.afterHLead,beforeVLead:candidate.afterVLead,allowedTypes,lookahead:false});
   assert.equal(candidate.nextCost,next.length?Math.min(...next.map(item=>item.cost)):1000000);
  }
 }
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

test('straight planning varies key loops and may double a type to correct lead',()=>{
 assert.equal(validateStraightAntiRollCycle(),true);
 assert.equal(STRAIGHT_ANTI_ROLL_CYCLE.length,18);
 const plan=runAutoPlan({startRingNum:'R0001',startKey:'L2',startHLead:0,startVLead:0,ringCount:20,alignmentType:'straight',allowedTypes:['U','R','L']});
 assert.ok(plan.plannedRings.every(ring=>ring.planningRule==='adaptive-anti-roll'));
 assert.ok(new Set(plan.plannedRings.map(ring=>ring.key)).size>=6);
 const keys=['L2',...plan.plannedRings.map(ring=>ring.key)];
 for(let index=3;index<keys.length;index++) assert.notDeepEqual(keys.slice(index-3,index+1),[keys[index-1],keys[index],keys[index-1],keys[index]]);
 const correction=runAutoPlan({startRingNum:'R0001',startKey:'L15',startHLead:-55.43,startVLead:-22.96,ringCount:2,alignmentType:'straight',allowedTypes:['U','R','L']});
 assert.equal(correction.plannedRings[0].type,'L');
 assert.match(correction.plannedRings[0].reason,/เบิ้ล LT เพื่อแก้ Lead/);
 const correctionTypes=['L',...runAutoPlan({startRingNum:'R0001',startKey:'L15',startHLead:-55.43,startVLead:-22.96,ringCount:12,alignmentType:'straight',allowedTypes:['U','R','L']}).plannedRings.map(r=>r.type)];
 for(let index=2;index<correctionTypes.length;index++) assert.notDeepEqual(correctionTypes.slice(index-2,index+1),[correctionTypes[index],correctionTypes[index],correctionTypes[index]]);
 assert.ok(evaluateCandidates({beforeKey:'R4',alignmentType:'straight',allowedTypes:['U','R','L']}).some(candidate=>candidate.type==='R'));
 assert.ok(evaluateCandidates({beforeKey:'L2',alignmentType:'straight',allowedTypes:['L']}).every(candidate=>candidate.type==='L'));
});

test('users can cap an alternating key-pair loop before the planner changes pair',()=>{
 const threeLoops=['L15','R1','L15','R1','L15','R1'];
 const completingThird=straightAntiRollMeta('L15','R1',threeLoops.slice(0,-1),3);
 assert.equal(completingThird.pairLoopCount,3);
 assert.equal(completingThird.loopLimitExceeded,false);
 assert.equal(straightAntiRollMeta('R1','L15',threeLoops,3).loopLimitExceeded,true);
 const candidates=evaluateCandidates({beforeKey:'R1',alignmentType:'straight',allowedTypes:['R','L'],recentKeys:threeLoops,maxPairLoops:3,lookahead:false});
 assert.equal(candidates.some(candidate=>candidate.key==='L15'),false);
 assert.ok(candidates.length>0);
 const autoKeys=['L2',...runAutoPlan({startKey:'L2',startHLead:0,startVLead:0,ringCount:20,alignmentType:'straight',allowedTypes:['R','L'],maxPairLoops:1}).plannedRings.map(ring=>ring.key)];
 for(let index=2;index<autoKeys.length;index++) assert.notEqual(autoKeys[index],autoKeys[index-2]);
 const straight={...section,code:'LOOP-LIMIT',sectionType:'tangent',direction:'straight',radius:0,startSTA:'00+000.000',endSTA:'00+028.000',ratio:{un:0,rt:1,lt:1},allowedTypes:['R','L']};
 const vertical={code:'FLAT-LOOP-LIMIT',curveType:'constant_grade',startSTA:straight.startSTA,endSTA:straight.endSTA,startElev:0,endElev:0,gradePct:0,radiusV:0};
 const advanceKeys=['L15',...runAdvancePlan({sections:[straight],verticalAlignment:[vertical],startKey:'L15',startHLead:0,startVLead:0,maxPairLoops:1,recovery:{initialStateConfirmed:true}}).plannedRings.map(ring=>ring.selectedKey)];
 for(let index=2;index<advanceKeys.length;index++) assert.notEqual(advanceKeys[index],advanceKeys[index-2]);
 assert.throws(()=>runAutoPlan({alignmentType:'straight',maxPairLoops:0}),/ลูปคู่เดิมสูงสุด/);
 assert.throws(()=>runAdvancePlan({maxPairLoops:11}),/ลูปคู่เดิมสูงสุด/);
});

test('continuous straight planning changes key loops instead of repeating A-B-A-B',()=>{
 const straight={...section,code:'ANTI-ROLL',sectionType:'tangent',direction:'straight',radius:0,startSTA:'00+000.000',endSTA:'00+042.000',ratio:{un:0,rt:1,lt:1},allowedTypes:['R','L']};
 const vertical={code:'FLAT-ANTI-ROLL',curveType:'constant_grade',startSTA:straight.startSTA,endSTA:straight.endSTA,startElev:0,endElev:0,gradePct:0,radiusV:0};
 const plan=runAdvancePlan({sections:[straight],verticalAlignment:[vertical],startKey:'L15',startHLead:0,startVLead:0,recovery:{initialStateConfirmed:true}});
 const keys=plan.plannedRings.map(ring=>ring.selectedKey);
 for(let index=3;index<keys.length;index++) assert.notDeepEqual(keys.slice(index-3,index+1),[keys[index-1],keys[index],keys[index-1],keys[index]]);
 assert.ok(plan.plannedRings.every(ring=>ring.rolling));
});

test('sequence visual joins saved plans to the new plan with continuous curve geometry',()=>{
 const history=runAutoPlan({startRingNum:'R0001',startKey:'L2',startHLead:0,startVLead:0,ringCount:3,alignmentType:'right',radius:180}).plannedRings;
 const current=runAutoPlan({startRingNum:'R0004',startKey:history.at(-1).selectedKey,startHLead:history.at(-1).afterH,startVLead:history.at(-1).afterV,ringCount:2,alignmentType:'left',radius:300}).plannedRings;
 const visual=buildSequenceVisualPlan({historyPlans:[...history,{...history[0],ringNum:'R0099'}],currentRings:current,alignmentType:'left',radius:300,startRingNum:'R0004'});
 assert.equal(visual.historyCount,3);assert.equal(visual.currentCount,2);assert.equal(visual.plannedRings.length,5);
 assert.ok(visual.plannedRings.slice(0,3).every(r=>r.planSource==='history'));
 assert.ok(visual.plannedRings.slice(3).every(r=>r.planSource==='current'));
 for(let index=1;index<visual.plannedRings.length;index++) {
  assert.equal(visual.plannedRings[index].startX,visual.plannedRings[index-1].endX);
  assert.equal(visual.plannedRings[index].startY,visual.plannedRings[index-1].endY);
 }
 const expectedTurn=[...history,...current].reduce((sum,ring)=>sum+ring.leadReq/6300,0)*180/Math.PI;
 assert.ok(Math.abs(visual.totalTurnDeg-expectedTurn)<.001);
});

test('legacy or incomplete gap settings are repaired before any planning mode runs',()=>{
 assert.deepEqual(normalizeGapSettings({}),DEFAULT_GAP_SETTINGS);
 assert.deepEqual(normalizeGapSettings({initialGapTop:120,initialGapBottom:'',initialGapLeft:-3,initialGapRight:null,warnThreshold:2,criticalThreshold:5}),DEFAULT_GAP_SETTINGS);
 assert.equal(normalizeGapSettings({initialGapTop:'44',warnThreshold:'12',criticalThreshold:'4'}).initialGapTop,44);
 assert.equal(runAutoPlan({startRingNum:'R0001',startKey:'L2',gapSettings:{}}).plannedRings.length,10);
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
  if(plan.summary.level==='critical'||plan.endpoint.level==='critical')assert.equal(plan.verdict.status,'INFEASIBLE');
  else assert.equal(plan.verdict.status,'UNKNOWN');
  assert.equal(plan.ratioDiagnostics.length,1);
 }
});

const straightSection={...section,code:'STRAIGHT',sectionType:'tangent',direction:'straight',radius:0,startSTA:'00+000.000',endSTA:'00+050.000'};
const flatVertical={code:'FLAT',curveType:'constant_grade',startSTA:'00+000.000',endSTA:'00+050.000',startElev:0,endElev:0,gradePct:0,radiusV:0};

test('recovery reference preserves measured initial pose and ends at zero position and tangent',()=>{
 for(const offset of [-80,0,80])for(const angle of [-.1,0,.1]) {
  const begin=recoveryTarget(0,20,offset,radians(angle)),end=recoveryTarget(20,20,offset,radians(angle));
  assert.equal(begin.offsetMm,offset);assert.ok(Math.abs(begin.headingRad-radians(angle))<1e-10);
  assert.deepEqual(end,{offsetMm:0,headingRad:0});assert.deepEqual(recoveryTarget(30,20,offset,radians(angle)),end);
  assert.ok(Math.abs(recoveryTarget(19.999,20,offset,radians(angle)).headingRad)<1e-7);
 }
});

test('parallel offset remains offset while an outward heading accumulates geometric drift on both axes',()=>{
 const route=createRoute([{...straightSection,endSTA:'00+100.000'}],[{...flatVertical,endSTA:'00+100.000'}]);
 const config={...DEFAULT_RECOVERY,startDeviationH:50,startDeviationV:-30,startHeadingErrorDeg:.1,startPitchErrorDeg:-.1};
 const begin=initialRecoveryState(route,config);
 const result=propagateRecovery(begin,route,100,0,0);
 assert.ok(Math.abs(result.deviationH-(50+100*Math.sin(radians(.1))*1000))<1e-7);
 assert.ok(Math.abs(result.deviationV-(-30-100*Math.tan(radians(.1))*1000))<1e-7);
 const parallel=propagateRecovery(initialRecoveryState(route,{...config,startHeadingErrorDeg:0,startPitchErrorDeg:0}),route,100,0,0);
 assert.ok(Math.abs(parallel.deviationH-50)<1e-7);assert.ok(Math.abs(parallel.deviationV+30)<1e-7);
});

test('endpoint checks direction even with zero offset and never certify an assumed or incomplete baseline',()=>{
 const config={...DEFAULT_RECOVERY,initialStateConfirmed:true};
 const pose={deviationH:0,deviationV:0,headingError:radians(.2),pitchError:0};
 let check=endpointAssessment(pose,config);
 assert.equal(check.positionPass,true);assert.equal(check.headingPass,false);assert.equal(check.passed,false);
 pose.headingError=0;pose.deviationV=-76;assert.equal(endpointAssessment(pose,config).positionPass,false);
 pose.deviationV=0;assert.equal(endpointAssessment(pose,config).passed,true);
 pose.longitudinalDeviation=76;assert.equal(endpointAssessment(pose,config).positionPass,false);pose.longitudinalDeviation=0;
 assert.equal(endpointAssessment(pose,{...config,initialStateConfirmed:false}).passed,false);
 assert.equal(endpointAssessment(pose,config,false).known,false);
});

test('both strategies recover positive and negative offsets without silently ignoring yaw or pitch',()=>{
 for(const strategy of ['senior_ai','ratio_guided'])for(const sign of [-1,1]){
  const plan=runAdvancePlan({sections:[straightSection],verticalAlignment:[flatVertical],strategy,startHLead:0,startVLead:0,
   recovery:{startDeviationH:50*sign,startDeviationV:30,startHeadingErrorDeg:.1,initialStateConfirmed:true}});
  assert.equal(plan.plannedRings[0].startX,.05*sign);
  assert.ok(Math.abs(plan.endpoint.deviationH)<20);assert.ok(Math.abs(plan.endpoint.deviationV)<30);
  assert.equal(plan.endpoint.passed,plan.endpoint.positionPass&&plan.endpoint.headingPass);
  if(!plan.endpoint.headingPass)assert.equal(plan.verdict.status,'INFEASIBLE');
  if(sign===1)assert.equal(plan.endpoint.headingPass,true);
  assert.equal(plan.plannedRings.at(-1).endSTA,'00+050.000');
  assert.equal(plan.endpoint.deviationH,plan.plannedRings.at(-1).deviationMm);
  if(plan.summary.level==='critical')assert.equal(plan.verdict.status,'INFEASIBLE'); // endpoint success does not hide ring risks
 }
});

test('planning starts at measured STA in either direction, preserves transition progress and samples exact endpoint inside last ring',()=>{
 for(const sign of [-1,1]){
  const sec={...straightSection,startSTA:sign===1?'00+000.000':'00+050.000',endSTA:sign===1?'00+050.000':'00+000.000'};
  const vert={...flatVertical,startSTA:sec.startSTA,endSTA:sec.endSTA};
  const plan=runAdvancePlan({sections:[sec],verticalAlignment:[vert],startSTA:'00+025.250'});
  assert.equal(plan.plannedRings[0].sta,'00+025.250');assert.equal(plan.plannedRings.at(-1).endSTA,sec.endSTA);
  assert.ok(Math.abs(plan.plannedRings.reduce((s,r)=>s+r.simulatedLengthM,0)-plan.recovery.totalDistanceM)<.001);
  assert.ok(plan.recovery.finalRingBeyondEndpointM>=0 && plan.recovery.finalRingBeyondEndpointM<1.4);
 }
 const transition={...straightSection,sectionType:'transition_in',direction:'right',radius:100};
 const route=createRoute([transition],[flatVertical],'00+025.000');
 assert.ok(Math.abs(route.curvature(0)-.005)<1e-12);
});

test('short or constrained plans expose unreachable endpoint rather than claiming recovery',()=>{
 const sec={...straightSection,endSTA:'00+001.000'};
 const plan=runAdvancePlan({sections:[sec],verticalAlignment:[{...flatVertical,endSTA:sec.endSTA}],
   recovery:{startDeviationH:500,startDeviationV:-500,recoveryDistanceM:20,initialStateConfirmed:true}});
 assert.equal(plan.recovery.effectiveDistanceM,1);assert.equal(plan.endpoint.positionPass,false);
 assert.equal(plan.verdict.status,'INFEASIBLE');assert.equal(plan.endpoint.passed,false);
 const absent=runAdvancePlan({sections:[straightSection],verticalAlignment:[],recovery:{initialStateConfirmed:true}});
 assert.equal(absent.recovery.verticalKnown,false);assert.equal(absent.endpoint.known,false);
});

test('invalid recovery numbers and out-of-range current STA are rejected',()=>{
 const input={sections:[straightSection],verticalAlignment:[flatVertical]};
 for(const recovery of [{startDeviationH:''},{startDeviationV:NaN},{startHeadingErrorDeg:11},{startPitchErrorDeg:null},
  {recoveryDistanceM:0},{endpointToleranceMm:-1},{endpointHeadingToleranceDeg:0},{maxTaperTurnDeg:0},{responseDiameterMm:0}])assert.throws(()=>runAdvancePlan({...input,recovery}));
 for(const startSTA of ['bad','00+051.000','00+050.000'])assert.throws(()=>runAdvancePlan({...input,startSTA}));
});

test('vertical reference honors actual endpoint elevations and curvature rather than inventing zero elevation',()=>{
 const route=createRoute([straightSection],[{...flatVertical,curveType:'sag_curve',radiusV:2500,startElev:10,endElev:11}]);
 assert.equal(route.verticalAt(0).elevation,10);assert.equal(route.verticalAt(50).elevation,11);
 assert.ok(Math.abs(route.verticalAt(25).elevation-10.375)<1e-10);
 const begin=initialRecoveryState(route,{...DEFAULT_RECOVERY,startDeviationV:40});
 assert.ok(Math.abs(begin.tbmZ-10.04)<1e-10);
 assert.ok(Math.abs(begin.pitchError)<1e-10);
 assert.equal(assessRing({...normal,deviationMm:0,deviationVMm:80}).level,'critical');
});

test('a ring crossing an alignment boundary respects allowed segment types in both spans',()=>{
 const first={...straightSection,code:'ONE',endSTA:'00+005.250',allowedTypes:['R','L'],ratio:{un:0,rt:1,lt:1}};
 const second={...straightSection,code:'TWO',startSTA:first.endSTA,endSTA:'00+012.000',allowedTypes:['U','R'],ratio:{un:1,rt:1,lt:0}};
 for(const strategy of ['senior_ai','ratio_guided']) {
  const plan=runAdvancePlan({sections:[first,second],verticalAlignment:[{...flatVertical,endSTA:second.endSTA}],strategy});
  const crossing=plan.plannedRings.find(r=>r.dist<5.25 && r.dist+r.simulatedLengthM>5.25);
  assert.ok(crossing);assert.equal(crossing.type,'R');
  assert.equal(plan.plannedRings.at(-1).endSTA,'00+012.000');
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

import { validateAlignment, validateGapSettings, validatePlanningInput, summarizeRings, getLimits, predictGaps } from './decisionSupport.js';
import { KEY_DATA, NEXT_RING_TABLE, SUITABILITY_MATRIX } from '../data/tbmConstants.js';
import { getAdaptiveWeights } from './aiCalibrator.js';
import { DEFAULT_RECOVERY, validateRecovery, createRoute, initialRecoveryState, propagateRecovery, recoveryTarget, endpointAssessment, radians, degrees, rounded } from './alignmentRecovery.js';
import { DEFAULT_GAP_SETTINGS, normalizeGapSettings } from './gapSettings.js';
import { DEFAULT_MAX_PAIR_LOOPS, MAX_PAIR_LOOPS_LIMIT, straightAntiRollEnabled, straightAntiRollMeta } from './straightRolling.js';

export { DEFAULT_GAP_SETTINGS, normalizeGapSettings } from './gapSettings.js';

/** Discrete-key planning with a measured initial pose, a smooth return reference,
 * and independent position/direction checks at the exact alignment endpoint.
 * Taper response and tail gap remain simplified predictions, not shield control.
 */
export const SEGMENT_SIZES = { U: 1200, R: 1400, L: 1400 };
export const TBM_DIAMETER_MM = 6300;

export function parseSTA(staStr) {
  if (typeof staStr === 'number') return staStr;
  if (!staStr) return 0;
  const cleaned = String(staStr).replace(/\s+/g, '');
  if (cleaned.includes('+')) {
    const parts = cleaned.split('+');
    return parseFloat(parts[0]) * 1000 + parseFloat(parts[1] || '0');
  }
  return parseFloat(cleaned) || 0;
}

export function formatSTA(meters) {
  if (isNaN(meters)) return '00+000.000';
  meters = Math.round(meters * 1000) / 1000;
  const km = Math.floor(meters / 1000);
  const m = (meters % 1000).toFixed(3);
  return `${String(km).padStart(2, '0')}+${String(m).padStart(7, '0')}`;
}

export const RATIO_PRESETS = [
  { label: '3 : 1 : 0 (Full Curve 75% UN)', un: 3, rt: 1, lt: 0, desc: '75% UN (1.2m), 25% RT (1.4m)' },
  { label: '2 : 1 : 0 (UN Heavy)', un: 2, rt: 1, lt: 0, desc: '67% UN, 33% RT' },
  { label: '1 : 1 : 1 (Equal Mix)', un: 1, rt: 1, lt: 1, desc: '33% each' },
  { label: '0 : 23 : 13 (Transition Spec)', un: 0, rt: 23, lt: 13, desc: 'Drawing spec: 64% RT, 36% LT' },
  { label: '1 : 0 : 0 (100% UN)', un: 1, rt: 0, lt: 0, desc: 'Pure Universal' },
  { label: '0 : 1 : 1 (RT/LT Alternating)', un: 0, rt: 1, lt: 1, desc: '50/50 RT LT' },
];

export const DEFAULT_ALIGNMENT_SECTIONS = [
  { id: 'sec-1', code: '12"', name: 'Transition In (Right)', sectionType: 'transition_in', direction: 'right', startSTA: '20+272.724', endSTA: '20+222.724', radius: 180, ratio: { un: 0, rt: 23, lt: 13 }, allowedTypes: ['R', 'L'], planningMode: 'locked_ratio', isLocked: true },
  { id: 'sec-2', code: '13', name: 'Full Curve (Right)', sectionType: 'full_curve', direction: 'right', startSTA: '20+222.724', endSTA: '20+133.511', radius: 180, ratio: { un: 3, rt: 1, lt: 0 }, allowedTypes: ['U', 'R'], planningMode: 'locked_ratio', isLocked: true },
  { id: 'sec-3', code: '13A', name: 'Transition Out (Right)', sectionType: 'transition_out', direction: 'right', startSTA: '20+133.511', endSTA: '20+083.511', radius: 180, ratio: { un: 0, rt: 23, lt: 13 }, allowedTypes: ['R', 'L'], planningMode: 'locked_ratio', isLocked: true },
];

export const DEFAULT_VERTICAL_ALIGNMENT = [
  { id: 'vpi-1', code: 'VPI-01', name: 'Entry Grade (-1.2%)', startSTA: '20+272.724', endSTA: '20+200.000', startElev: 12.5, endElev: 11.628, gradePct: -1.2, curveType: 'constant_grade', radiusV: 0, lengthV: 72.724 },
  { id: 'vpi-2', code: 'VPI-02', name: 'Sag Curve', startSTA: '20+200.000', endSTA: '20+140.000', startElev: 11.628, endElev: 11.45, gradePct: -0.3, curveType: 'sag_curve', radiusV: 2500, lengthV: 60 },
  { id: 'vpi-3', code: 'VPI-03', name: 'Exit Grade (+0.85%)', startSTA: '20+140.000', endSTA: '20+083.511', startElev: 11.45, endElev: 11.93, gradePct: 0.85, curveType: 'constant_grade', radiusV: 0, lengthV: 56.489 },
];

export function estimateRingCount(startSTA, endSTA, ratio) {
  const dist = Math.abs(parseSTA(endSTA) - parseSTA(startSTA));
  if (dist <= 0) return 0;
  const un = Math.max(0, Number(ratio?.un) || 0);
  const rt = Math.max(0, Number(ratio?.rt) || 0);
  const lt = Math.max(0, Number(ratio?.lt) || 0);
  const sum = un + rt + lt;
  if (sum === 0) return Math.round(dist / 1.3);
  const avgLen = (un / sum) * 1.2 + ((rt + lt) / sum) * 1.4;
  return Math.round(dist / avgLen);
}

export function createNewSection(type = 'full_curve', dir = 'right', radius = 180) {
  return {
    id: `sec-${Date.now()}`,
    code: `SEC-${Math.floor(Math.random() * 900 + 100)}`,
    name: type === 'full_curve' ? 'Full Curve' : type === 'tangent' ? 'Tangent Line' : 'Transition Curve',
    sectionType: type, direction: dir,
    startSTA: '00+000.000', endSTA: '00+000.000',
    radius: Number(radius) || 180,
    ratio: { un: 1, rt: 1, lt: 1 },
    allowedTypes: ['U', 'R', 'L'],
    planningMode: 'locked_ratio',
    isLocked: true,
  };
}

export function createNewVerticalElement() {
  return {
    id: `vpi-${Date.now()}`,
    code: `VPI-${Math.floor(Math.random() * 90 + 10)}`,
    name: 'New Grade / Curve',
    startSTA: '00+000.000', endSTA: '00+000.000',
    startElev: 0, endElev: 0, gradePct: 0,
    curveType: 'constant_grade', radiusV: 0, lengthV: 0,
  };
}

export function calculateSectionLeadRequired({ sectionType, direction, radius, segSizeMm, distanceProgress }) {
  if (direction === 'straight' || sectionType === 'tangent' || !radius || radius <= 0) return 0;
  const sign = direction === 'right' ? 1 : -1;
  const fullLead = (6300 * Number(segSizeMm)) / (Number(radius) * 1000) * sign;
  if (sectionType === 'full_curve') return Number(fullLead.toFixed(2));
  if (sectionType === 'transition_in') return Number((fullLead * distanceProgress).toFixed(2));
  if (sectionType === 'transition_out') return Number((fullLead * (1 - distanceProgress)).toFixed(2));
  return Number(fullLead.toFixed(2));
}

export function calculateVerticalLeadRequired(vElem, segSizeMm) {
  if (!vElem || vElem.curveType === 'constant_grade' || !vElem.radiusV || vElem.radiusV <= 0) return 0;
  const sign = vElem.curveType === 'sag_curve' ? 1 : -1;
  return Number(((6300 * Number(segSizeMm)) / (Number(vElem.radiusV) * 1000) * sign).toFixed(2));
}

export function computeRatioBreakdown(ratio, totalRings) {
  const un = Math.max(0, Number(ratio?.un) || 0);
  const rt = Math.max(0, Number(ratio?.rt) || 0);
  const lt = Math.max(0, Number(ratio?.lt) || 0);
  const sum = un + rt + lt;
  if (sum === 0) return { ratioStr: '0:0:0', unPct: 0, rtPct: 0, ltPct: 0, unCount: 0, rtCount: 0, ltCount: 0 };
  const unPct = Number(((un / sum) * 100).toFixed(1));
  const rtPct = Number(((rt / sum) * 100).toFixed(1));
  const ltPct = Number(((lt / sum) * 100).toFixed(1));
  const count = Math.max(0, Math.floor(Number(totalRings)));
  const raw = [un, rt, lt].map(value => value / sum * count);
  const allocation = raw.map(Math.floor);
  const order = raw.map((value, index) => ({ index, remainder: value - allocation[index] })).sort((a,b) => b.remainder-a.remainder || a.index-b.index);
  const remainderCount = count-allocation.reduce((a,b)=>a+b,0);
  for (let i=0; i<remainderCount; i++) allocation[order[i].index]++;
  const [unCount, rtCount, ltCount] = allocation;
  return { ratioStr: `${un}:${rt}:${lt}`, unPct, rtPct, ltPct, unCount, rtCount, ltCount };
}

export function findBestRatioForSection(section, startKey = 'U4', startH = -20, startV = -10, limit = 55.0, gapSettings = DEFAULT_GAP_SETTINGS) {
  const allowed = Array.isArray(section.allowedTypes) && section.allowedTypes.length > 0 ? section.allowedTypes : ['U', 'R', 'L'];
  const allowU = allowed.includes('U'), allowR = allowed.includes('R'), allowL = allowed.includes('L');
  if (section.sectionType === 'tangent' || section.direction === 'straight') {
    if (allowU) return { un: 1, rt: 0, lt: 0 };
    if (allowR && allowL) return { un: 0, rt: 1, lt: 1 };
    return { un: allowU ? 1 : 0, rt: allowR ? 1 : 0, lt: allowL ? 1 : 0 };
  }
  const isRight = section.direction === 'right';
  const raw = isRight
    ? [{ un:3,rt:1,lt:0 },{ un:2,rt:1,lt:0 },{ un:4,rt:1,lt:0 },{ un:1,rt:1,lt:0 },{ un:1,rt:2,lt:0 },{ un:0,rt:1,lt:0 },{ un:0,rt:23,lt:13 }]
    : [{ un:3,rt:0,lt:1 },{ un:2,rt:0,lt:1 },{ un:4,rt:0,lt:1 },{ un:1,rt:0,lt:1 },{ un:1,rt:0,lt:2 },{ un:0,rt:0,lt:1 },{ un:0,rt:13,lt:23 }];
  const cands = raw.map(c => ({ un: allowU ? c.un : 0, rt: allowR ? c.rt : 0, lt: allowL ? c.lt : 0 })).filter(c => c.un + c.rt + c.lt > 0);
  if (cands.length === 0) return { un: allowU ? 1 : 0, rt: allowR ? 1 : 0, lt: allowL ? 1 : 0 };
  let best = cands[0], bestScore = Infinity;
  for (const ratio of cands) {
    let res;
    try { res = runAdvancePlan({ sections: [{ ...section, ratio, allowedTypes: allowed }], startKey, startHLead: startH, startVLead: startV, maxTolerance: limit, startRingNumber: 1, gapSettings, strategy: 'ratio_guided' }); } catch { continue; }
    const score = res.summary.critical.length * 100000 + res.summary.warnings.length * 1000 + Math.abs(res.maxDeviationMm) + res.maxObservedLead;
    if (score < bestScore) { bestScore = score; best = ratio; }
  }
  if (!Number.isFinite(bestScore)) throw new Error('ไม่มีลำดับคีย์ที่ต่อเนื่องได้ภายใต้ชนิดเซ็กเมนต์ที่อนุญาต');
  return best;
}


export function runAdvancePlan({
  sections=DEFAULT_ALIGNMENT_SECTIONS, verticalAlignment=DEFAULT_VERTICAL_ALIGNMENT,
  startKey='U4', startHLead=-20, startVLead=-10, maxTolerance=55, startRingNumber=1,
  strategy='senior_ai', steeringSign='steering_bias', gapSettings=DEFAULT_GAP_SETTINGS,
  ringLogs=[], startSTA=null, recovery={}, maxPairLoops=DEFAULT_MAX_PAIR_LOOPS,
}) {
  const config={...DEFAULT_RECOVERY,...recovery};
  const gConfig=normalizeGapSettings(gapSettings);
  const errors=[...validatePlanningInput({startKey,startHLead,startVLead,maxTolerance}),
    ...validateAlignment(sections,verticalAlignment),...validateGapSettings(gConfig),...validateRecovery(config)];
  if(!Number.isSafeInteger(Number(startRingNumber)) || Number(startRingNumber)<1) errors.push('หมายเลขริงเริ่มต้นต้องเป็นจำนวนเต็มมากกว่า 0');
  if(!Number.isInteger(Number(maxPairLoops)) || Number(maxPairLoops)<1 || Number(maxPairLoops)>MAX_PAIR_LOOPS_LIMIT) errors.push(`ลูปคู่เดิมสูงสุดต้องเป็นจำนวนเต็ม 1–${MAX_PAIR_LOOPS_LIMIT}`);
  if(!['senior_ai','ratio_guided'].includes(strategy)) errors.push('วิธีเลือกคีย์ไม่ถูกต้อง');
  if(startSTA!==null && startSTA!=='' && !/^(\d+\+\d+(\.\d+)?|\d+(\.\d+)?)$/.test(String(startSTA))) errors.push('STA ปัจจุบันไม่ถูกต้อง');
  if(errors.length) throw new Error(errors.join(' · '));
  const route=createRoute(sections,verticalAlignment,startSTA);
  const recoveryLength=Math.min(Number(config.recoveryDistanceM),route.totalDistance);
  const responseDiameter=Number(config.responseDiameterMm);
  const W=getAdaptiveWeights(ringLogs), limit=Number(maxTolerance);
  const limits={...getLimits(gConfig),lead:limit};
  const recoveryActive=Math.abs(Number(config.startDeviationH))>0.5||Math.abs(Number(config.startDeviationV))>0.5||
    Math.abs(Number(config.startHeadingErrorDeg))>0.001||Math.abs(Number(config.startPitchErrorDeg))>0.001;
  // A full vertical profile is required before an endpoint can be marked known.
  const coveredVertical=verticalAlignment.map(v=>[Math.min(parseSTA(v.startSTA),parseSTA(v.endSTA)),Math.max(parseSTA(v.startSTA),parseSTA(v.endSTA))]).sort((a,b)=>a[0]-b[0]);
  let coveredTo=Math.min(route.staAt(0),route.staAt(route.totalDistance));
  for(const [from,to] of coveredVertical) {if(from>coveredTo+.000001)break;if(to>coveredTo)coveredTo=to;}
  const verticalKnown=coveredTo>=Math.max(route.staAt(0),route.staAt(route.totalDistance)) && verticalAlignment.length>0;
  let current={...initialRecoveryState(route,config),key:startKey,h:Number(startHLead),v:Number(startVLead),
    used:Object.fromEntries(sections.map(sec=>[sec.code,{U:0,R:0,L:0}])),recentKeys:[],recentSectionCode:null};
  const plannedRings=[],violations=[],gapAlerts=[];
  const targetAt=distance=>({
    h:recoveryTarget(distance,recoveryLength,Number(config.startDeviationH),radians(Number(config.startHeadingErrorDeg))),
    v:recoveryTarget(distance,recoveryLength,Number(config.startDeviationV),radians(Number(config.startPitchErrorDeg))),
  });
  const evaluate=(state,key)=>{
    const data=KEY_DATA[key], size=SEGMENT_SIZES[data.type], sizeM=size/1000;
    const sec=route.at(state.distance).section;
    const antiRollEnabled=straightAntiRollEnabled(sec.sectionType==='tangent'||sec.direction==='straight'?'straight':sec.direction,sec.allowedTypes||['U','R','L']);
    const loopHistory=state.recentSectionCode===sec.code?state.recentKeys:[];
    const rolling=antiRollEnabled&&!recoveryActive?straightAntiRollMeta(state.key,key,loopHistory,maxPairLoops):null;
    const turnH=-data.hLead/responseDiameter,turnV=-data.vLead/responseDiameter;
    const projected=propagateRecovery(state,route,sizeM,turnH,turnV);
    const leadReq=responseDiameter*(projected.dtaTheta-state.dtaTheta);
    const vLeadReq=responseDiameter*(projected.dtaPitch-state.dtaPitch);
    const afterH=rounded(state.h+data.hLead+leadReq,2),afterV=rounded(state.v+data.vLead+vLeadReq,2);
    const gaps=predictGaps(afterH,afterV,gConfig),minGap=Math.min(...Object.values(gaps));
    const suitability=SUITABILITY_MATRIX[KEY_DATA[state.key].pos]?.[data.pos] || 'Fair';
    const overLimitAmount=Math.max(0,Math.abs(afterH)-limit,Math.abs(afterV)-limit);
    const articulationDeg=Math.hypot(degrees(turnH),degrees(turnV));
    const target=targetAt(projected.distance);
    const hError=projected.deviationH-target.h.offsetMm, vError=projected.deviationV-target.v.offsetMm;
    const yawError=projected.headingError-target.h.headingRad,pitchError=projected.pitchError-target.v.headingRad;
    // Position and heading are separate objectives. Direction error is also
    // projected over a short horizon, so parallel-but-offset is not treated as fixed.
    const horizon=Math.min(5,Math.max(1,route.totalDistance-projected.distance));
    const futureH=hError+Math.tan(yawError)*horizon*1000;
    const futureV=vError+Math.tan(pitchError)*horizon*1000;
    const alignmentCost=3*(Math.abs(hError)+Math.abs(vError))+8*(Math.abs(futureH)+Math.abs(futureV));
    const nearEnd=Math.max(0,1-(route.totalDistance-projected.distance)/recoveryLength);
    const terminalCost=nearEnd*(2*(Math.abs(projected.deviationH)+Math.abs(projected.deviationV))+
      10000*(Math.abs(projected.headingError)+Math.abs(projected.pitchError)));
    const baseTargetH=steeringSign==='standard_positive'?leadReq:-.72*leadReq;
    const leadCost=.2*(Math.abs(afterH-baseTargetH)+Math.abs(afterV));
    const ratio=Object.fromEntries(Object.entries(sec.ratio).map(([key,value])=>[key,Number(value)])), sum=ratio.un+ratio.rt+ratio.lt, used=state.used[sec.code];
    const count=used.U+used.R+used.L+1;
    const targetRatio={U:ratio.un/sum,R:ratio.rt/sum,L:ratio.lt/sum};
    const ratioCost=['U','R','L'].reduce((cost,type)=>cost+Math.abs((used[type]+(type===data.type?1:0))/count-targetRatio[type]),0)*(strategy==='ratio_guided'?150:35);
    // Safety takes priority over reference tracking; impossible recovery remains visible.
    const hardCost=(suitability==='No'?1e7:0)+(minGap<=gConfig.criticalThreshold?1e7:0)+
      (articulationDeg>Number(config.maxTaperTurnDeg)?1e7+(articulationDeg-Number(config.maxTaperTurnDeg))*1e6:0);
    const softCost=(suitability==='Fair'?150:0)+(minGap<=gConfig.warnThreshold?10000:0)+overLimitAmount*200*Math.max(W.hScoreCoeff/2.5,W.vScoreCoeff/2);
    const reachesEnd=projected.distance>=route.totalDistance-1e-7;
    const endpointCost=reachesEnd ?
      (Math.max(0,Math.abs(projected.deviationH)-Number(config.endpointToleranceMm))+Math.max(0,Math.abs(projected.deviationV)-Number(config.endpointToleranceMm))+Math.max(0,Math.abs(projected.longitudinalDeviation)-Number(config.endpointToleranceMm)))*10000+
      (Math.max(0,Math.abs(degrees(projected.headingError))-Number(config.endpointHeadingToleranceDeg))+Math.max(0,Math.abs(degrees(projected.pitchError))-Number(config.endpointHeadingToleranceDeg)))*1000000 : 0;
    const outsideAlignmentCost=(Math.max(0,Math.abs(projected.deviationH)-limits.deviation)+Math.max(0,Math.abs(projected.deviationV)-limits.deviation))*3000;
    // A measured alignment recovery may temporarily leave the production loop.
    // With no recovery active, candidate filtering enforces the configured
    // repeated pair, balanced boundary double, and next pair.
    const rollingPreference=rolling?(rolling.recentKeyPenalty+(recoveryActive?0:rolling.repeatedPairPenalty)):0;
    const rollingCost=rollingPreference*(recoveryActive?0.1:1)+(rolling?.longSameTypePenalty||0);
    const cost=hardCost+softCost+alignmentCost+outsideAlignmentCost+terminalCost+leadCost+ratioCost+endpointCost+rollingCost;
    const nextUsed={...state.used,[sec.code]:{...used,[data.type]:used[data.type]+1}};
    return {key,type:data.type,size,sizeM:sizeM.toFixed(1),segHLead:data.hLead,segVLead:data.vLead,
      leadReq:rounded(leadReq,2),vLeadReq:rounded(vLeadReq,2),afterH,afterV,suitability,...gaps,minGap,
      exceedsLimit:overLimitAmount>0,overLimitAmount:rounded(overLimitAmount,2),isGapWarn:minGap<=gConfig.warnThreshold,
      isGapCrit:minGap<=gConfig.criticalThreshold,articulationDeg:rounded(articulationDeg),taperTurnDeg:rounded(articulationDeg),articulationExceeded:articulationDeg>Number(config.maxTaperTurnDeg),
      target,cost,totalScore:rounded(-cost,2),rolling,rollingCost,projected:{...projected,key,h:afterH,v:afterV,used:nextUsed,
        recentKeys:antiRollEnabled?[...loopHistory,key].slice(-24):[],recentSectionCode:sec.code}};
  };
  const candidates=state=>{
    const available=(NEXT_RING_TABLE[state.key]||[]).filter(key=>{
    const type=KEY_DATA[key].type,start=route.startOffset+state.distance;
    const end=Math.min(route.startOffset+route.totalDistance,start+SEGMENT_SIZES[type]/1000);
    return route.spans.filter(span=>span.end>start+1e-7 && span.start<end-1e-7).every(span=>(span.section.allowedTypes||['U','R','L']).includes(type));
    });
    const sec=route.at(state.distance).section;
    const antiRollEnabled=straightAntiRollEnabled(sec.sectionType==='tangent'||sec.direction==='straight'?'straight':sec.direction,sec.allowedTypes||['U','R','L']);
    const loopHistory=state.recentSectionCode===sec.code?state.recentKeys:[];
    return antiRollEnabled&&!recoveryActive?available.filter(key=>!straightAntiRollMeta(state.key,key,loopHistory,maxPairLoops).loopLimitExceeded):available;
  };
  const select=state=>{
    const nearEndpoint=route.totalDistance-state.distance<=8.4;
    const width=nearEndpoint?24:6,depthLimit=nearEndpoint?7:3;
    let beams=candidates(state).map(key=>{const result=evaluate(state,key);return {first:result,state:result.projected,cost:result.cost};});
    if(!beams.length) throw new Error(`ช่วง ${route.at(state.distance).section.code}: ไม่มีคีย์ต่อเนื่องที่ใช้ได้`);
    beams.sort((a,b)=>a.cost-b.cost);beams=beams.slice(0,width);
    for(let depth=1;depth<depthLimit;depth++) {
      const expanded=[];
      for(const beam of beams) {
        if(beam.state.distance>=route.totalDistance-1e-7){expanded.push(beam);continue;}
        for(const key of candidates(beam.state)) {
          const result=evaluate(beam.state,key);
          expanded.push({first:beam.first,state:result.projected,cost:beam.cost+result.cost*Math.pow(.9,depth)});
        }
      }
      if(!expanded.length) throw new Error('ไม่มีลำดับคีย์ต่อเนื่องที่วางแผนต่อได้ในช่วงถัดไป');
      expanded.sort((a,b)=>a.cost-b.cost);beams=expanded.slice(0,width);
    }
    return beams[0].first;
  };
  while(current.distance<route.totalDistance-1e-7 && plannedRings.length<13000) {
    const chosen=select(current),next=chosen.projected,sec=route.at(current.distance).section;
    const step=plannedRings.length+1,ringNumInt=Number(startRingNumber)+step-1;
    const ringNum=`R${String(ringNumInt).padStart(4,'0')}`;
    const previousMagnitude=Math.hypot(current.deviationH,current.deviationV),magnitude=Math.hypot(next.deviationH,next.deviationV);
    const driftTrend=magnitude>previousMagnitude+.5?'diverging':magnitude<previousMagnitude-.5?'converging':'stable';
    const remaining=Math.max(0,route.totalDistance-next.distance);
    const {projected:ignoredProjected,target:ignoredTarget,...fields}=chosen;
    void ignoredProjected;void ignoredTarget;
    const doublesType=chosen.rolling&&KEY_DATA[current.key]?.type===chosen.type;
    const loopReason=chosen.rolling?.changedPairAfterLimit?`ครบ ${chosen.rolling.maxPairLoops} ลูป · เบิ้ลเพื่อเปลี่ยนคู่คีย์`:chosen.rolling?.repeatsPair?`ลูปคู่ ${chosen.rolling.pairKeys.join(' ↔ ')} รอบ ${chosen.rolling.pairLoopCount}/${chosen.rolling.maxPairLoops}`:chosen.rolling?.loopPhase==='establish'?'ตั้งคู่คีย์ใหม่':'เริ่มลูป Anti-Roll';
    const actionReason=doublesType?(chosen.rolling?.changedPairAfterLimit?`เบิ้ล ${chosen.type==='R'?'RT':'LT'} เพื่อเปลี่ยนลูป`:`เบิ้ล ${chosen.type==='R'?'RT':'LT'} เพื่อแก้ Lead/แนว`):'สลับ RT/LT';
    const antiRollReason=chosen.rolling?`${actionReason} · ${loopReason} · `:'';
    const aiReasoning=`${antiRollReason}${driftTrend==='converging'?'กำลังกลับเข้าแนว':driftTrend==='diverging'?'ยังเยื้องเพิ่ม — ต้องตรวจทาน':'ระยะเยื้องคงที่'} · H/V คาดการณ์ ${rounded(next.deviationH,1)}/${rounded(next.deviationV,1)} mm · มุมคลาด H/V ${rounded(degrees(next.headingError),3)}/${rounded(degrees(next.pitchError),3)}° · เหลือ ${rounded(remaining,1)} m`;
    const ring={...fields,recordType:'planned',initialStateConfirmed:config.initialStateConfirmed===true,initialPoseSTA:formatSTA(route.staAt(0)),step,ringNum,ringNumInt,sta:formatSTA(route.staAt(current.distance)),
      endSTA:formatSTA(route.staAt(next.distance)),dist:rounded(current.distance,3),sectionCode:sec.code,sectionName:sec.name,sectionType:sec.sectionType,
      prevKey:current.key,selectedKey:chosen.key,startX:rounded(current.tbmX),startY:rounded(current.tbmY),endX:rounded(next.tbmX),endY:rounded(next.tbmY),
      theta:rounded(next.tbmTheta,6),dtaTheta:rounded(next.dtaTheta,6),dtaStartX:rounded(current.dtaX),dtaStartY:rounded(current.dtaY),
      dtaEndX:rounded(next.dtaX),dtaEndY:rounded(next.dtaY),dtaX:rounded(next.dtaX),dtaY:rounded(next.dtaY),tbmX:rounded(next.tbmX),tbmY:rounded(next.tbmY),
      deviationMm:rounded(next.deviationH,1),deviationVMm:rounded(next.deviationV,1),predictedDeviationMm:rounded(next.deviationH,1),
      longitudinalDeviationMm:rounded(next.longitudinalDeviation,1),
      headingErrorDeg:rounded(degrees(next.headingError),4),pitchErrorDeg:rounded(degrees(next.pitchError),4),
      targetDeviationH:rounded(chosen.target.h.offsetMm,1),targetDeviationV:rounded(chosen.target.v.offsetMm,1),
      targetX:rounded(next.dtaX+chosen.target.h.offsetMm/1000*Math.cos(next.dtaTheta)),
      targetY:rounded(next.dtaY-chosen.target.h.offsetMm/1000*Math.sin(next.dtaTheta)),
      simulatedLengthM:rounded(next.distance-current.distance,4),remainingDistanceM:rounded(remaining,3),
      riskIndex:Math.min(100,Math.round(Math.max(Math.abs(next.deviationH),Math.abs(next.deviationV))/75*25+overRisk(chosen,limit,Number(config.maxTaperTurnDeg)))),
      aiReasoning,driftTrend,driftRate:rounded(magnitude-previousMagnitude,1),
      notes:`แผนจำลอง H/V DTA ${rounded(next.deviationH,1)}/${rounded(next.deviationV,1)} mm · ${aiReasoning}`};
    plannedRings.push(ring);
    if(chosen.exceedsLimit)violations.push({step,ringNum,afterH:chosen.afterH,afterV:chosen.afterV,limit});
    if(chosen.isGapWarn)gapAlerts.push({step,ringNum,minGap:chosen.minGap,isCritical:chosen.isGapCrit});
    current=next;
  }
  if(current.distance<route.totalDistance-1e-7)throw new Error('แผนเกิน 13000 ริง กรุณาแบ่งระยะวางแผน');
  const summary=summarizeRings(plannedRings,limits),endpoint=endpointAssessment(current,config,verticalKnown);
  const articulationCount=plannedRings.filter(r=>r.articulationExceeded).length;
  const verdictStatus=summary.level==='critical'||endpoint.level==='critical'||articulationCount?'INFEASIBLE':
    !endpoint.known?'UNKNOWN':summary.level==='warning'?'WARNING':summary.level==='normal'?'OPTIMAL':'UNKNOWN';
  const ratioDiagnostics=sections.filter(sec=>plannedRings.some(r=>r.sectionCode===sec.code)).map(sec=>{
    const rings=plannedRings.filter(r=>r.sectionCode===sec.code),expected=computeRatioBreakdown(sec.ratio,rings.length);
    const actual={un:rings.filter(r=>r.type==='U').length,rt:rings.filter(r=>r.type==='R').length,lt:rings.filter(r=>r.type==='L').length};
    return {sectionCode:sec.code,expected,actual,matches:expected.unCount===actual.un&&expected.rtCount===actual.rt&&expected.ltCount===actual.lt};
  });
  const counts={un:plannedRings.filter(r=>r.type==='U').length,rt:plannedRings.filter(r=>r.type==='R').length,lt:plannedRings.filter(r=>r.type==='L').length};
  const last=plannedRings.at(-1);
  return {summary,endpoint,ratioDiagnostics,sections,totalRings:plannedRings.length,maxTolerance:limit,maxPairLoops:Number(maxPairLoops),counts,plannedRings,violations,gapAlerts,
    maxObservedLead:rounded(Math.max(...plannedRings.map(r=>Math.max(Math.abs(r.afterH),Math.abs(r.afterV)))),2),
    maxDeviationMm:rounded(Math.max(...plannedRings.map(r=>Math.abs(r.deviationMm))),1),
    maxVerticalDeviationMm:rounded(Math.max(...plannedRings.map(r=>Math.abs(r.deviationVMm))),1),
    minObservedGap:Math.min(...plannedRings.map(r=>r.minGap)),maxArticulationDeg:Math.max(...plannedRings.map(r=>r.articulationDeg)),
    avgRiskIndex:Math.round(plannedRings.reduce((sum,r)=>sum+r.riskIndex,0)/plannedRings.length),violationCount:violations.length,gapWarningCount:gapAlerts.length,
    strategy,gapSettings:gConfig,aiWeights:{calibrated:W.calibrated,sampleSize:W.sampleSize},
    recovery:{...config,effectiveDistanceM:recoveryLength,totalDistanceM:rounded(route.totalDistance,3),verticalKnown,
      endpointSTA:formatSTA(route.staAt(route.totalDistance)),startSTA:formatSTA(route.staAt(0)),
      finalRingBeyondEndpointM:rounded(last.size/1000-last.simulatedLengthM,4)},
    verdict:{status:verdictStatus,message:endpoint.level==='critical'?'ผลคาดการณ์ปลายทางยังไม่เข้าเกณฑ์ตำแหน่งหรือทิศทาง':
      !endpoint.known?'ยังยืนยันปลายทางไม่ได้ — ตรวจข้อมูลตั้งต้นและแนวดิ่ง':summary.level==='normal'?'ผลจำลองอยู่ในเกณฑ์ที่ตรวจ — รอตรวจทานก่อนใช้':'มีริงที่ต้องตรวจทาน',
      advice:[`ปลายทาง H/V ${endpoint.deviationH}/${endpoint.deviationV} mm · มุมคลาด ${endpoint.headingErrorDeg}/${endpoint.pitchErrorDeg}°`,
        `มุม Taper ต่อริงเกินเพดานแบบจำลอง ${articulationCount} ริง`,
        'แบบจำลองคีย์ไม่ใช่คำสั่งบังคับ TBM ต้องตรวจ Survey, Navigation และข้อจำกัดเครื่องก่อนใช้']}};
}

function overRisk(chosen,limit,taperLimit) {
  return Math.min(25,Math.max(Math.abs(chosen.afterH),Math.abs(chosen.afterV))/limit*25)+
    Math.min(25,Math.max(0,(50-chosen.minGap)/50*25))+Math.min(25,chosen.articulationDeg/taperLimit*25);
}

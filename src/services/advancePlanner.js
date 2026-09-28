import { validateAlignment, validateGapSettings, validatePlanningInput, summarizeRings, getLimits } from './decisionSupport.js';
import { KEY_DATA, NEXT_RING_TABLE, SUITABILITY_MATRIX } from '../data/tbmConstants.js';
import { getAdaptiveWeights } from './aiCalibrator.js';

/**
 * ============================================================================
 * AI SENIOR TUNNEL ENGINEER v2.0 — EXPERT-LEVEL PLANNING ENGINE
 * ============================================================================
 * 6 Intelligence Systems:
 * 1. N-Ring Beam Search Lookahead (depth=3, width=3)
 * 2. Drift Trend Detection (Moving Average + Rate of Change)
 * 3. Articulation Angle Constraint (Physical 0.5° limit)
 * 4. Risk Score + Explainable AI Reasoning
 * 5. Section Transition Pre-Planning (Lead Blending)
 * 6. Adaptive Weight Calibration from Ring Log History
 * ============================================================================
 */

export const SEGMENT_SIZES = { U: 1200, R: 1400, L: 1400 };
export const TBM_DIAMETER_MM = 6300;

export const DEFAULT_GAP_SETTINGS = {
  initialGapTop: 50.0,
  initialGapBottom: 50.0,
  initialGapLeft: 50.0,
  initialGapRight: 50.0,
  warnThreshold: 15.0,
  criticalThreshold: 5.0,
  shieldLength: 4.2,
};

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

// ============================================================================
// SYSTEM 1: BEAM SEARCH LOOKAHEAD
// ============================================================================
function beamSearchSelect(state, availableCandidates, scoreFn, simFn, depth, width) {
  // Level 0: score all candidates
  let beams = availableCandidates.map(candKey => {
    const { score, result } = scoreFn(state, candKey);
    return { path: [candKey], score, lastState: simFn(state, result) };
  });

  beams.sort((a, b) => b.score - a.score);
  beams = beams.slice(0, width);

  // Levels 1..depth-1
  for (let d = 1; d < depth; d++) {
    let nextBeams = [];
    for (const beam of beams) {
      if (beam.lastState.coveredDistance >= beam.lastState.totalDistance) { nextBeams.push(beam); continue; }
      const nextCands = getFilteredCandidates(beam.lastState.currentKey, beam.lastState.allowedTypes);
      for (const candKey of nextCands) {
        const { score, result } = scoreFn(beam.lastState, candKey);
        nextBeams.push({
          path: [...beam.path, candKey],
          score: beam.score + score * Math.pow(0.85, d), // Discount future scores
          lastState: d < depth - 1 ? simFn(beam.lastState, result) : null,
        });
      }
    }
    if (!nextBeams.length) break;
    nextBeams.sort((a, b) => b.score - a.score);
    beams = nextBeams.slice(0, width);
  }

  return beams.length > 0 ? beams[0].path[0] : availableCandidates[0];
}

function getFilteredCandidates(currentKey, allowedTypes) {
  return (NEXT_RING_TABLE[currentKey] || []).filter(k => allowedTypes.includes(KEY_DATA[k].type));
}

// ============================================================================
// SYSTEM 2: DRIFT TREND DETECTION
// ============================================================================
function computeDriftTrend(deviationHistory, window = 5) {
  if (deviationHistory.length < 3) return { rate: 0, trend: 'stable', avgDev: 0 };
  const recent = deviationHistory.slice(-window);
  const n = recent.length;
  const avgDev = recent.reduce((s, v) => s + v, 0) / n;

  // Linear regression slope
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += recent[i]; sumXY += i * recent[i]; sumXX += i * i;
  }
  const rate = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);

  const trend = Math.abs(rate) < 0.5 ? 'stable' : rate > 0 ? 'diverging' : 'converging';
  return { rate: Number(rate.toFixed(2)), trend, avgDev: Number(avgDev.toFixed(1)) };
}

// ============================================================================
// SYSTEM 4: RISK SCORE CALCULATOR
// ============================================================================
function computeRiskIndex(afterH, afterV, minGap, deviationMm, articulationDeg, limit) {
  // Each factor contributes 0-25 points to risk (total 0-100)
  const leadRisk = Math.min(25, (Math.max(Math.abs(afterH), Math.abs(afterV)) / limit) * 25);
  const gapRisk = Math.min(25, Math.max(0, (50 - minGap) / 50 * 25));
  const devRisk = Math.min(25, (Math.abs(deviationMm) / 100) * 25);
  const artRisk = Math.min(25, (articulationDeg / 0.5) * 25);
  return Math.round(leadRisk + gapRisk + devRisk + artRisk);
}

function generateAIReasoning(chosen, dynamicTargetH, curDevMm, driftTrend, articulationDeg, nextSecInfo) {
  const reasons = [];

  // Steering reason
  if (Math.abs(curDevMm) > 10) {
    const dir = curDevMm > 0 ? 'ขวา' : 'ซ้าย';
    reasons.push(`แก้ไข Deviation ${Math.abs(curDevMm).toFixed(0)}mm (เบน${dir})`);
  } else {
    reasons.push(`DTA คาดการณ์ (Dev ${Math.abs(curDevMm).toFixed(0)}mm)`);
  }

  // Gap reason
  if (chosen.minGap < 15) {
    reasons.push(`⚠️ คลายแรงเลี้ยว ป้องกัน Gap แคบ (${chosen.minGap.toFixed(0)}mm)`);
  } else if (chosen.minGap > 35) {
    reasons.push(`Gap คาดการณ์อยู่ในเกณฑ์ (${chosen.minGap.toFixed(0)}mm)`);
  }

  // Drift trend reason
  if (driftTrend.trend === 'diverging') {
    reasons.push(`📈 ตรวจพบแนวโน้ม Drift เพิ่ม → เพิ่มแรงแก้ไข`);
  } else if (driftTrend.trend === 'converging') {
    reasons.push(`📉 กำลังลู่เข้า → ลดแรงแก้ไขป้องกัน Overshoot`);
  }

  // Articulation reason
  if (articulationDeg > 0.35) {
    reasons.push(`🔗 มุมข้อต่อ ${articulationDeg.toFixed(2)}° → เลือก Key นุ่มนวล`);
  }

  // Transition reason
  if (nextSecInfo) {
    reasons.push(`🔀 เตรียมเข้า ${nextSecInfo}`);
  }

  return reasons.join(' | ');
}

// ============================================================================
// MAIN PLANNING ENGINE
// ============================================================================
export function runAdvancePlan({
  sections = DEFAULT_ALIGNMENT_SECTIONS,
  verticalAlignment = DEFAULT_VERTICAL_ALIGNMENT,
  startKey = 'U4',
  startHLead = -20.0,
  startVLead = -10.0,
  maxTolerance = 55.0,
  startRingNumber = 1,
  strategy = 'senior_ai',
  steeringSign = 'steering_bias',
  gapSettings = DEFAULT_GAP_SETTINGS,
  ringLogs = [],
}) {
  const inputErrors = [...validatePlanningInput({ startKey, startHLead, startVLead, maxTolerance }), ...validateAlignment(sections, verticalAlignment), ...validateGapSettings(gapSettings)];
  if (!Number.isSafeInteger(Number(startRingNumber)) || Number(startRingNumber)<1) inputErrors.push('หมายเลขริงเริ่มต้นต้องเป็นจำนวนเต็มมากกว่า 0');
  if (!['senior_ai','ratio_guided'].includes(strategy)) inputErrors.push('วิธีเลือกคีย์ไม่ถูกต้อง');
  if (inputErrors.length) throw new Error(inputErrors.join(' · '));
  const limit = Number(maxTolerance);
  let currentKey = startKey || 'U4';
  let currentH = Number(startHLead); if (isNaN(currentH)) currentH = -20.0;
  let currentV = Number(startVLead); if (isNaN(currentV)) currentV = -10.0;

  // System 6: Adaptive Weights from Ring Log
  const W = getAdaptiveWeights(ringLogs);

  const gConfig = { ...DEFAULT_GAP_SETTINGS, ...(gapSettings || {}) };
  const initGapT = Number(gConfig.initialGapTop);
  const initGapB = Number(gConfig.initialGapBottom);
  const initGapL = Number(gConfig.initialGapLeft);
  const initGapR = Number(gConfig.initialGapRight);
  const warnGapLimit = Number(gConfig.warnThreshold);
  const critGapLimit = Number(gConfig.criticalThreshold);

  const allPlannedRings = [];
  const violations = [];
  const gapAlerts = [];

  let globalRingIndex = 0;
  let currentRingNumber = Number(startRingNumber) || 1;
  let dtaX = 0, dtaY = 0, dtaTheta = 0;
  let tbmX = 0, tbmY = 0, tbmTheta = 0;
  let prevTbmTheta = 0; // System 3: Articulation tracking

  const isSeniorAIMode = strategy === 'senior_ai';

  // System 2: Deviation history for drift trend
  const deviationHistory = [];

  sections.forEach((sec, secIdx) => {
    const startMeters = parseSTA(sec.startSTA);
    const endMeters = parseSTA(sec.endSTA);
    const totalDistance = Math.abs(endMeters - startMeters);
    const isDecreasingSTA = endMeters < startMeters;
    if (totalDistance < 0.1) return;

    const allowedTypes = Array.isArray(sec.allowedTypes) && sec.allowedTypes.length > 0 ? sec.allowedTypes : ['U', 'R', 'L'];
    const allowU = allowedTypes.includes('U'), allowR = allowedTypes.includes('R'), allowL = allowedTypes.includes('L');

    const un = allowU ? Math.max(0, Number(sec.ratio?.un) || 0) : 0;
    const rt = allowR ? Math.max(0, Number(sec.ratio?.rt) || 0) : 0;
    const lt = allowL ? Math.max(0, Number(sec.ratio?.lt) || 0) : 0;
    const ratioSum = un + rt + lt;
    const targetUnPct = ratioSum > 0 ? un / ratioSum : (allowU ? 1 : 0);
    const targetRtPct = ratioSum > 0 ? rt / ratioSum : (allowR ? 1 : 0);
    const targetLtPct = ratioSum > 0 ? lt / ratioSum : (allowL ? 1 : 0);

    const isSectionLocked = sec.isLocked === true || sec.planningMode === 'locked_ratio';
    const isSectionAutoAI = sec.planningMode === 'ai_senior';
    const enforceRatioForThisSec = isSectionLocked || (!isSeniorAIMode && !isSectionAutoAI);

    // System 5: Next section info for transition blending
    const nextSec = secIdx < sections.length - 1 ? sections[secIdx + 1] : null;
    let nextSecLeadTarget = null;
    if (nextSec && nextSec.radius > 0 && nextSec.direction !== 'straight' && nextSec.sectionType !== 'tangent') {
      const nextSign = nextSec.direction === 'right' ? 1 : -1;
      const nextFullLead = (6300 * 1300) / (nextSec.radius * 1000) * nextSign;
      nextSecLeadTarget = steeringSign === 'standard_positive' ? nextFullLead : -0.72 * nextFullLead;
    } else if (nextSec) {
      nextSecLeadTarget = 0;
    }

    let sectionRingIndex = 0;
    let sectionUsed = { U: 0, R: 0, L: 0 };
    let coveredDistance = 0;
    let currentSTAMeters = startMeters;

    while (coveredDistance < totalDistance - 0.01 && sectionRingIndex < 13000) {
      globalRingIndex++;
      sectionRingIndex++;
      const ringNumFormatted = `R${String(currentRingNumber).padStart(4, '0')}`;
      const beforePos = KEY_DATA[currentKey]?.pos || parseInt(currentKey.replace(/\D/g, '') || '1', 10);

      const availableCandidates = getFilteredCandidates(currentKey, allowedTypes);
      if (!availableCandidates.length) throw new Error(`ช่วง ${sec.code}: ไม่มีคีย์ต่อเนื่องที่ใช้ได้`);
      const distanceProgress = Math.min(1.0, coveredDistance / totalDistance);
      const distanceRemaining = totalDistance - coveredDistance;

      const matchingVElem = verticalAlignment?.find(v => {
        const vS = parseSTA(v.startSTA), vE = parseSTA(v.endSTA);
        return currentSTAMeters >= Math.min(vS, vE) - 0.1 && currentSTAMeters <= Math.max(vS, vE) + 0.1;
      });

      const curDevMm = Number((((tbmX - dtaX) * Math.cos(dtaTheta) - (tbmY - dtaY) * Math.sin(dtaTheta)) * 1000).toFixed(1));
      const headError = tbmTheta - dtaTheta;

      // System 2: Drift trend
      deviationHistory.push(curDevMm);
      const driftTrend = computeDriftTrend(deviationHistory, W.driftTrendWindow);

      const totalSoFar = sectionUsed.U + sectionUsed.R + sectionUsed.L;
      const currentUnPct = totalSoFar > 0 ? sectionUsed.U / totalSoFar : 0;
      const currentRtPct = totalSoFar > 0 ? sectionUsed.R / totalSoFar : 0;
      const currentLtPct = totalSoFar > 0 ? sectionUsed.L / totalSoFar : 0;

      // System 5: Transition blending
      let transitionBlendInfo = null;
      if (nextSec && nextSecLeadTarget !== null && distanceRemaining < W.transitionBlendZone) {
        const blendT = 1 - (distanceRemaining / W.transitionBlendZone);
        transitionBlendInfo = { blendT, nextTarget: nextSecLeadTarget, nextSecName: nextSec.code };
      }

      // Build scoring state
      const scoringState = {
        currentKey, currentH, currentV, beforePos,
        dtaX, dtaY, dtaTheta, tbmX, tbmY, tbmTheta, prevTbmTheta,
        curDevMm, headError, driftTrend, distanceProgress, distanceRemaining,
        sec, matchingVElem, allowedTypes,
        sectionUsed: { ...sectionUsed }, totalSoFar, currentUnPct, currentRtPct, currentLtPct,
        targetUnPct, targetRtPct, targetLtPct,
        enforceRatioForThisSec, isSectionLocked,
        transitionBlendInfo,
        W, limit, initGapT, initGapB, initGapL, initGapR, warnGapLimit, critGapLimit,
        coveredDistance, totalDistance,
      };

      // Scoring function for a candidate
      const scoreFn = (state, candKey) => {
        const candData = KEY_DATA[candKey] || { hLead: 0, vLead: 0, pos: 1, type: candKey.charAt(0) };
        const candType = candData.type;
        const candSize = SEGMENT_SIZES[candType] || 1400;
        const candDistM = candSize / 1000;
        const wouldOvershoot = (state.coveredDistance + candDistM) > (state.totalDistance + 0.5);

        const leadReq = calculateSectionLeadRequired({
          sectionType: state.sec.sectionType, direction: state.sec.direction,
          radius: state.sec.radius, segSizeMm: candSize, distanceProgress: state.distanceProgress,
        });
        const vLeadReq = calculateVerticalLeadRequired(state.matchingVElem, candSize);

        const afterH = Number((candData.hLead + state.currentH + leadReq).toFixed(2));
        const afterV = Number((candData.vLead + state.currentV + vLeadReq).toFixed(2));
        const suitability = SUITABILITY_MATRIX[state.beforePos]?.[candData.pos] || 'Fair';
        const exceedsLimit = Math.abs(afterH) > state.limit || Math.abs(afterV) > state.limit;
        const overLimitAmount = Math.max(0, Math.abs(afterH) - state.limit, Math.abs(afterV) - state.limit);

        const gapL = Math.max(0, Math.min(100, Number((state.initGapL - 0.30 * afterH).toFixed(1))));
        const gapR = Math.max(0, Math.min(100, Number((state.initGapR + 0.30 * afterH).toFixed(1))));
        const gapT = Math.max(0, Math.min(100, Number((state.initGapT - 0.30 * afterV).toFixed(1))));
        const gapB = Math.max(0, Math.min(100, Number((state.initGapB + 0.30 * afterV).toFixed(1))));
        const minGap = Math.min(gapL, gapR, gapT, gapB);
        const isGapWarn = minGap <= state.warnGapLimit;
        const isGapCrit = minGap <= state.critGapLimit;

        let suitScore = suitability === 'Yes' ? state.W.suitYes : suitability === 'Fair' ? state.W.suitFair : state.W.suitNo;

        // Dynamic target with PD control
        let baseTargetH = 0;
        if ((state.sec.direction === 'right' && leadReq > 0) || (state.sec.direction === 'left' && leadReq < 0)) {
          baseTargetH = steeringSign === 'standard_positive' ? leadReq : -0.72 * leadReq;
        }

        // System 2: Adaptive PD gain based on drift trend
        let Kp_eff = state.W.Kp;
        let Kd_eff = state.W.Kd;
        if (state.driftTrend.trend === 'diverging') {
          Kp_eff *= 1.4; // Stronger correction when drifting away
          Kd_eff *= 1.2;
        } else if (state.driftTrend.trend === 'converging') {
          Kp_eff *= 0.7; // Softer correction to prevent overshoot
          Kd_eff *= 0.8;
        }

        let devCorr = (Kp_eff * 1.25) * state.curDevMm + (Kd_eff * 1.1) * state.headError;
        devCorr = Math.max(-25, Math.min(25, devCorr));

        let dynamicTargetH = baseTargetH + devCorr;

        // System 5: Blend with next section target near transition
        if (state.transitionBlendInfo) {
          const { blendT, nextTarget } = state.transitionBlendInfo;
          dynamicTargetH = dynamicTargetH * (1 - blendT) + nextTarget * blendT;
        }

        const hScore = 320 - Math.pow(Math.abs(afterH - dynamicTargetH), 1.35) * (state.W.hScoreCoeff * 1.5);
        const vScore = 160 - Math.pow(Math.abs(afterV), 1.2) * state.W.vScoreCoeff;

        let gapScore;
        if (isGapCrit) gapScore = state.W.gapCriticalPenalty;
        else if (isGapWarn) gapScore = state.W.gapWarnPenalty - (state.warnGapLimit - minGap) * 120;
        else if (minGap < 25) gapScore = -(25 - minGap) * 15;
        else gapScore = 60;

        // System 3: Articulation angle penalty
        const candTbmTurn = (-1 * candData.hLead) / TBM_DIAMETER_MM;
        const newTbmTheta = state.tbmTheta + candTbmTurn;
        const articulationRad = Math.abs(newTbmTheta - state.tbmTheta);
        const articulationDeg = articulationRad * (180 / Math.PI);
        let articulationPenalty = 0;
        if (articulationDeg > state.W.articulationHardLimit) {
          articulationPenalty = -800 - (articulationDeg - state.W.articulationHardLimit) * 2000;
        } else if (articulationDeg > state.W.articulationSoftLimit) {
          articulationPenalty = -(articulationDeg - state.W.articulationSoftLimit) * 400;
        }

        let ratioScore = 0;
        if (state.enforceRatioForThisSec) {
          const tPct = candType === 'U' ? state.targetUnPct : candType === 'R' ? state.targetRtPct : state.targetLtPct;
          if (tPct === 0) ratioScore = -600;
          else if (state.totalSoFar > 0) {
            const cPct = candType === 'U' ? state.currentUnPct : candType === 'R' ? state.currentRtPct : state.currentLtPct;
            ratioScore = (tPct - cPct) * (state.isSectionLocked ? 500 : 350);
          } else ratioScore = tPct * 150;
        }

        const limitPenalty = exceedsLimit ? overLimitAmount * 80 : 0;
        const overshootPenalty = wouldOvershoot ? 350 : 0;

        // Explicit DTA centerline alignment penalty
        const projected = simFn(state, { key:candKey, size:candSize, newTbmTheta, afterH, afterV });
        const predictedDeviationMm = projected.curDevMm;
        const devAlignmentPenalty = Math.abs(predictedDeviationMm) * 3.5 + Math.max(0, Math.abs(predictedDeviationMm)-75) * 20;
        const hardPenalty = (suitability === 'No' ? 100000 : 0) + (isGapCrit ? 100000 : 0);
        const totalScore = Number((suitScore + hScore + vScore + gapScore + ratioScore + articulationPenalty - devAlignmentPenalty - limitPenalty - overshootPenalty - hardPenalty).toFixed(2));

        return {
          score: totalScore,
          result: {
            key: candKey, type: candType, size: candSize, sizeM: (candSize / 1000).toFixed(1),
            segHLead: candData.hLead, segVLead: candData.vLead,
            leadReq, vLeadReq, afterH, afterV, suitability,
            exceedsLimit, overLimitAmount: Number(overLimitAmount.toFixed(2)),
            gapL, gapR, gapT, gapB, minGap, isGapWarn, isGapCrit,
            totalScore, wouldOvershoot, dynamicTargetH,
            articulationDeg: Number(articulationDeg.toFixed(3)),
            candTbmTurn, newTbmTheta, predictedDeviationMm,
          }
        };
      };

      // Simulation function for beam search: full kinematic state propagation
      const simFn = (state, result) => {
        const ringDistM = result.size / 1000;
        let nextDtaTheta = state.dtaTheta;
        if (state.sec.direction !== 'straight' && state.sec.sectionType !== 'tangent' && state.sec.radius > 0) {
          const signDir = state.sec.direction === 'right' ? 1 : -1;
          const prog = Math.min(1.0, (state.coveredDistance + ringDistM) / state.totalDistance);
          let curv = (1 / state.sec.radius) * signDir;
          if (state.sec.sectionType === 'transition_in') curv *= prog;
          else if (state.sec.sectionType === 'transition_out') curv *= (1 - prog);
          nextDtaTheta += curv * ringDistM;
        }
        const nextDtaX = state.dtaX + ringDistM * Math.sin(nextDtaTheta);
        const nextDtaY = state.dtaY + ringDistM * Math.cos(nextDtaTheta);
        const nextTbmX = state.tbmX + ringDistM * Math.sin(result.newTbmTheta);
        const nextTbmY = state.tbmY + ringDistM * Math.cos(result.newTbmTheta);
        const nextCurDevMm = Number((((nextTbmX - nextDtaX) * Math.cos(nextDtaTheta) - (nextTbmY - nextDtaY) * Math.sin(nextDtaTheta)) * 1000).toFixed(1));
        const nextHeadError = result.newTbmTheta - nextDtaTheta;

        const nextUsed = { ...state.sectionUsed };
        nextUsed[KEY_DATA[result.key].type]++;
        const nextTotal = state.totalSoFar + 1;
        return {
          ...state, sectionUsed: nextUsed, totalSoFar: nextTotal,
          currentUnPct: nextUsed.U / nextTotal, currentRtPct: nextUsed.R / nextTotal, currentLtPct: nextUsed.L / nextTotal,
          distanceRemaining: Math.max(0, state.totalDistance - state.coveredDistance - ringDistM),
          currentKey: result.key,
          currentH: result.afterH,
          currentV: result.afterV,
          beforePos: KEY_DATA[result.key]?.pos || 1,
          prevTbmTheta: state.tbmTheta,
          tbmTheta: result.newTbmTheta,
          dtaTheta: nextDtaTheta,
          dtaX: nextDtaX,
          dtaY: nextDtaY,
          tbmX: nextTbmX,
          tbmY: nextTbmY,
          curDevMm: nextCurDevMm,
          headError: nextHeadError,
          coveredDistance: state.coveredDistance + ringDistM,
          distanceProgress: Math.min(1.0, (state.coveredDistance + ringDistM) / state.totalDistance),
        };
      };

      // System 1: Use Beam Search in senior_ai mode (unlocked sections)
      let chosen;
      const useBeamSearch = isSeniorAIMode && W.beamSearchDepth > 1;

      if (useBeamSearch && availableCandidates.length > 1) {
        const bestKey = beamSearchSelect(scoringState, availableCandidates, scoreFn, simFn, W.beamSearchDepth, W.beamSearchWidth);
        const { result } = scoreFn(scoringState, bestKey);
        chosen = result;
      } else {
        // Greedy single-ring selection
        const evaluated = availableCandidates.map(k => scoreFn(scoringState, k));
        evaluated.sort((a, b) => b.score - a.score);
        chosen = evaluated[0].result;
      }

      sectionUsed[chosen.type]++;

      if (chosen.exceedsLimit) {
        violations.push({ step: globalRingIndex, ringNum: ringNumFormatted, sectionCode: sec.code, afterH: chosen.afterH, afterV: chosen.afterV, limit, overAmount: chosen.overLimitAmount });
      }
      if (chosen.isGapWarn) {
        gapAlerts.push({ step: globalRingIndex, ringNum: ringNumFormatted, sectionCode: sec.code, minGap: chosen.minGap, gapL: chosen.gapL, gapR: chosen.gapR, gapT: chosen.gapT, gapB: chosen.gapB, isCritical: chosen.isGapCrit, chosenKey: chosen.key });
      }

      const currentRingSTA = formatSTA(currentSTAMeters);
      const ringDistM = chosen.size / 1000;
      const prevDtaX = dtaX, prevDtaY = dtaY, prevTbmX = tbmX, prevTbmY = tbmY;

      // Use the same propagation for ranking, lookahead and displayed trajectory.
      const projected = simFn(scoringState, chosen);
      prevTbmTheta = tbmTheta;
      ({ dtaTheta, dtaX, dtaY, tbmTheta, tbmX, tbmY } = projected);

      const deviationMm = Number((((tbmX - dtaX) * Math.cos(dtaTheta) - (tbmY - dtaY) * Math.sin(dtaTheta)) * 1000).toFixed(1));

      // System 4: Risk score and AI reasoning
      const riskIndex = computeRiskIndex(chosen.afterH, chosen.afterV, chosen.minGap, deviationMm, chosen.articulationDeg, limit);
      const aiReasoning = generateAIReasoning(chosen, chosen.dynamicTargetH, deviationMm, driftTrend, chosen.articulationDeg, transitionBlendInfo?.nextSecName || null);

      allPlannedRings.push({
        recordType: 'planned', step: globalRingIndex, ringNum: ringNumFormatted, ringNumInt: currentRingNumber,
        sta: currentRingSTA, dist: Number(coveredDistance.toFixed(1)),
        sectionCode: sec.code, sectionName: sec.name, sectionType: sec.sectionType,
        prevKey: currentKey, selectedKey: chosen.key,
        type: chosen.type, size: chosen.size, sizeM: chosen.sizeM,
        segHLead: chosen.segHLead, segVLead: chosen.segVLead,
        leadReq: chosen.leadReq, vLeadReq: chosen.vLeadReq,
        afterH: chosen.afterH, afterV: chosen.afterV, suitability: chosen.suitability,
        exceedsLimit: chosen.exceedsLimit, overLimitAmount: chosen.overLimitAmount,
        gapT: chosen.gapT, gapB: chosen.gapB, gapL: chosen.gapL, gapR: chosen.gapR,
        minGap: chosen.minGap, isGapWarn: chosen.isGapWarn, isGapCrit: chosen.isGapCrit,
        startX: Number(prevTbmX.toFixed(3)), startY: Number(prevTbmY.toFixed(3)),
        endX: Number(tbmX.toFixed(3)), endY: Number(tbmY.toFixed(3)),
        theta: Number(tbmTheta.toFixed(4)),
        dtaStartX: Number(prevDtaX.toFixed(3)), dtaStartY: Number(prevDtaY.toFixed(3)),
        dtaEndX: Number(dtaX.toFixed(3)), dtaEndY: Number(dtaY.toFixed(3)),
        dtaTheta: Number(dtaTheta.toFixed(4)),
        dtaX: Number(dtaX.toFixed(3)), dtaY: Number(dtaY.toFixed(3)),
        tbmX: Number(tbmX.toFixed(3)), tbmY: Number(tbmY.toFixed(3)),
        deviationMm, predictedDeviationMm: chosen.predictedDeviationMm,
        // v2.0 New Fields
        riskIndex,
        aiReasoning,
        articulationDeg: chosen.articulationDeg,
        driftTrend: driftTrend.trend,
        driftRate: driftTrend.rate,
        notes: `Sec ${sec.code} [STA ${currentRingSTA}] H:${chosen.afterH} V:${chosen.afterV} Risk:${riskIndex} Gap(L:${chosen.gapL} R:${chosen.gapR})`,
      });

      if (isDecreasingSTA) currentSTAMeters -= ringDistM; else currentSTAMeters += ringDistM;
      coveredDistance += ringDistM;
      currentKey = chosen.key;
      currentH = chosen.afterH;
      currentV = chosen.afterV;
      currentRingNumber++;
    }
  });

  // Summary statistics
  const totalRings = allPlannedRings.length;
  let maxObservedLead = 0, maxDeviationMm = 0, maxArticulation = 0;
  let unCount = 0, rtCount = 0, ltCount = 0;
  let minObservedGap = 100, avgRiskIndex = 0;

  allPlannedRings.forEach(r => {
    const leadMag = Math.max(Math.abs(r.afterH), Math.abs(r.afterV));
    if (leadMag > maxObservedLead) maxObservedLead = leadMag;
    if (Math.abs(r.deviationMm) > Math.abs(maxDeviationMm)) maxDeviationMm = r.deviationMm;
    if (r.minGap < minObservedGap) minObservedGap = r.minGap;
    if (r.articulationDeg > maxArticulation) maxArticulation = r.articulationDeg;
    avgRiskIndex += r.riskIndex;
    if (r.type === 'U') unCount++; else if (r.type === 'R') rtCount++; else ltCount++;
  });
  avgRiskIndex = totalRings > 0 ? Math.round(avgRiskIndex / totalRings) : 0;

  const violationCount = violations.length;
  const gapWarningCount = gapAlerts.length;

  const summary = summarizeRings(allPlannedRings, { ...getLimits(gConfig), lead: limit });
  const verdictStatus = summary.level === 'critical' ? 'INFEASIBLE' : summary.level === 'warning' ? 'WARNING' : summary.level === 'normal' ? 'OPTIMAL' : 'UNKNOWN';
  const verdictMessage = summary.level === 'normal' ? `อยู่ในเกณฑ์ที่ตรวจ ${totalRings} ริง — รอตรวจทานก่อนใช้` : `พบ ${summary.problemCount} ริงที่ต้องตรวจทาน (Lead, DTA, Gap และ Suitability)`;
  const ratioDiagnostics = sections.filter(sec => sec.isLocked || sec.planningMode === 'locked_ratio' || strategy === 'ratio_guided').map(sec => {
    const rings = allPlannedRings.filter(r => r.sectionCode === sec.code);
    const expected = computeRatioBreakdown(sec.ratio, rings.length);
    const actual = { un: rings.filter(r=>r.type==='U').length, rt: rings.filter(r=>r.type==='R').length, lt: rings.filter(r=>r.type==='L').length };
    return { sectionCode: sec.code, expected, actual, matches: expected.unCount===actual.un && expected.rtCount===actual.rt && expected.ltCount===actual.lt };
  });
  const diagnosticAdvice = [
    `Lead เกินเกณฑ์ ${summary.leadCount} ริง · DTA เกิน ±75 mm ${summary.dtaCount} ริง · Gap เตือน/วิกฤต ${summary.gapCount} ริง`,
    'ผลเป็นแผนคาดการณ์จากแบบจำลอง ไม่ใช่ค่าตรวจวัดสนามหรือการรับรองแผน',
  ];

  return {
    summary, ratioDiagnostics, sections, totalRings, maxTolerance: limit,
    maxObservedLead: Number(maxObservedLead.toFixed(2)),
    maxDeviationMm: Number(maxDeviationMm.toFixed(1)),
    minObservedGap: Number(minObservedGap.toFixed(1)),
    maxArticulationDeg: Number(maxArticulation.toFixed(3)),
    avgRiskIndex,
    violationCount, gapWarningCount,
    gapSettings: gConfig,
    strategy,
    aiWeights: { calibrated: W.calibrated, sampleSize: W.sampleSize },
    verdict: { status: verdictStatus, message: verdictMessage, advice: diagnosticAdvice },
    counts: { un: unCount, rt: rtCount, lt: ltCount },
    plannedRings: allPlannedRings,
    violations, gapAlerts,
  };
}

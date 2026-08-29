import { KEY_DATA, NEXT_RING_TABLE, SUITABILITY_MATRIX } from '../data/tbmConstants.js';

/**
 * Segment Specifications
 * UN = 1.2 m (1200 mm)
 * RT / LT = 1.4 m (1400 mm)
 */
export const SEGMENT_SIZES = {
  U: 1200,
  R: 1400,
  L: 1400,
};

export const TBM_DIAMETER_MM = 6300;

/**
 * Parse STA string e.g. "20+272.724" -> 20272.724
 */
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

/**
 * Format meters to STA string e.g. 20272.724 -> "20+272.724"
 */
export function formatSTA(meters) {
  if (isNaN(meters)) return '00+000.000';
  const km = Math.floor(meters / 1000);
  const m = (meters % 1000).toFixed(3);
  return `${String(km).padStart(2, '0')}+${String(m).padStart(7, '0')}`;
}

export const RATIO_PRESETS = [
  { label: '3 : 1 : 0 (Full Curve 75% UN)', un: 3, rt: 1, lt: 0, desc: '75% UN (1.2m), 25% RT (1.4m) — Full Curve R=180' },
  { label: '2 : 1 : 0 (UN Heavy)', un: 2, rt: 1, lt: 0, desc: '67% UN, 33% RT, 0% LT' },
  { label: '1 : 1 : 1 (Equal Mix)', un: 1, rt: 1, lt: 1, desc: '33% UN, 33% RT, 33% LT balanced mix' },
  { label: '0 : 23 : 13 (Transition Spec)', un: 0, rt: 23, lt: 13, desc: 'Drawing spec transition: 64% RT, 36% LT' },
  { label: '1 : 0 : 0 (100% UN)', un: 1, rt: 0, lt: 0, desc: 'Pure 1.2m Universal segments' },
  { label: '0 : 1 : 1 (RT/LT Alternating)', un: 0, rt: 1, lt: 1, desc: '50% RT, 50% LT' },
];

/**
 * Default Horizontal Alignment Sections (MRT Purple Line Project)
 */
export const DEFAULT_ALIGNMENT_SECTIONS = [
  {
    id: 'sec-1',
    code: '12"',
    name: 'Transition In (Right)',
    sectionType: 'transition_in',
    direction: 'right',
    startSTA: '20+272.724',
    endSTA: '20+222.724',
    radius: 180,
    ratio: { un: 0, rt: 23, lt: 13 },
    allowedTypes: ['R', 'L'], // e.g. strictly forbidden UN in Transition 12" per drawing spec
  },
  {
    id: 'sec-2',
    code: '13',
    name: 'Full Curve (Right)',
    sectionType: 'full_curve',
    direction: 'right',
    startSTA: '20+222.724',
    endSTA: '20+133.511',
    radius: 180,
    ratio: { un: 3, rt: 1, lt: 0 },
    allowedTypes: ['U', 'R'], // forbidden LT in right curve
  },
  {
    id: 'sec-3',
    code: '13A',
    name: 'Transition Out (Right)',
    sectionType: 'transition_out',
    direction: 'right',
    startSTA: '20+133.511',
    endSTA: '20+083.511',
    radius: 180,
    ratio: { un: 0, rt: 23, lt: 13 },
    allowedTypes: ['R', 'L'],
  },
];

/**
 * Default Vertical Alignment Profile (MRT Purple Line Project)
 */
export const DEFAULT_VERTICAL_ALIGNMENT = [
  {
    id: 'vpi-1',
    code: 'VPI-01',
    name: 'Entry Grade (-1.2%)',
    startSTA: '20+272.724',
    endSTA: '20+200.000',
    startElev: 12.500,
    endElev: 11.628,
    gradePct: -1.20,
    curveType: 'constant_grade',
    radiusV: 0,
    lengthV: 72.724,
  },
  {
    id: 'vpi-2',
    code: 'VPI-02',
    name: 'Sag Curve (VPI STA 20+180)',
    startSTA: '20+200.000',
    endSTA: '20+140.000',
    startElev: 11.628,
    endElev: 11.450,
    gradePct: -0.30,
    curveType: 'sag_curve',
    radiusV: 2500,
    lengthV: 60.000,
  },
  {
    id: 'vpi-3',
    code: 'VPI-03',
    name: 'Exit Grade (+0.85%)',
    startSTA: '20+140.000',
    endSTA: '20+083.511',
    startElev: 11.450,
    endElev: 11.930,
    gradePct: 0.85,
    curveType: 'constant_grade',
    radiusV: 0,
    lengthV: 56.489,
  },
];

/**
 * Estimate ring count from STA distance and ratio mix
 */
export function estimateRingCount(startSTA, endSTA, ratio) {
  const dist = Math.abs(parseSTA(endSTA) - parseSTA(startSTA));
  if (dist <= 0) return 0;
  const un = Math.max(0, Number(ratio?.un) || 0);
  const rt = Math.max(0, Number(ratio?.rt) || 0);
  const lt = Math.max(0, Number(ratio?.lt) || 0);
  const sum = un + rt + lt;
  if (sum === 0) return Math.round(dist / 1.3);
  const avgLen = ((un / sum) * 1.2 + ((rt + lt) / sum) * 1.4);
  return Math.round(dist / avgLen);
}

export function createNewSection(type = 'full_curve', dir = 'right', radius = 180) {
  const id = `sec-${Date.now()}`;
  return {
    id,
    code: `SEC-${Math.floor(Math.random() * 900 + 100)}`,
    name: type === 'full_curve' ? 'Full Curve' : type === 'tangent' ? 'Tangent Line' : 'Transition Curve',
    sectionType: type,
    direction: dir,
    startSTA: '00+000.000',
    endSTA: '00+000.000',
    radius: Number(radius) || 180,
    ratio: { un: 1, rt: 1, lt: 1 },
    allowedTypes: ['U', 'R', 'L'], // default: allow all
  };
}

export function createNewVerticalElement() {
  const id = `vpi-${Date.now()}`;
  return {
    id,
    code: `VPI-${Math.floor(Math.random() * 90 + 10)}`,
    name: 'New Grade / Curve',
    startSTA: '00+000.000',
    endSTA: '00+000.000',
    startElev: 0.000,
    endElev: 0.000,
    gradePct: 0.0,
    curveType: 'constant_grade',
    radiusV: 0,
    lengthV: 0,
  };
}

/**
 * Calculate Lead Required (Horizontal Steering)
 * Formula: 6300 * Segment_Length_mm / (Radius * 1000)
 * Right curve (+), Left curve (-)
 * Transition sections: ramp linearly by distance progress (0.0 to 1.0)
 */
export function calculateSectionLeadRequired({
  sectionType,
  direction,
  radius,
  segSizeMm,
  distanceProgress,
}) {
  if (direction === 'straight' || sectionType === 'tangent' || !radius || radius <= 0) {
    return 0;
  }
  const sign = direction === 'right' ? 1 : -1;
  const fullLead = (6300 * Number(segSizeMm)) / (Number(radius) * 1000) * sign;

  if (sectionType === 'full_curve') return Number(fullLead.toFixed(2));
  if (sectionType === 'transition_in') return Number((fullLead * distanceProgress).toFixed(2));
  if (sectionType === 'transition_out') return Number((fullLead * (1 - distanceProgress)).toFixed(2));
  return Number(fullLead.toFixed(2));
}

/**
 * Calculate Vertical Lead Required (Vertical Steering for Crest / Sag curves)
 */
export function calculateVerticalLeadRequired(vElem, segSizeMm) {
  if (!vElem || vElem.curveType === 'constant_grade' || !vElem.radiusV || vElem.radiusV <= 0) {
    return 0;
  }
  const sign = vElem.curveType === 'sag_curve' ? 1 : -1; // Sag (upwards pitch +), Crest (downwards -)
  const fullVLead = (6300 * Number(segSizeMm)) / (Number(vElem.radiusV) * 1000) * sign;
  return Number(fullVLead.toFixed(2));
}

export function computeRatioBreakdown(ratio, totalRings) {
  const un = Math.max(0, Number(ratio?.un) || 0);
  const rt = Math.max(0, Number(ratio?.rt) || 0);
  const lt = Math.max(0, Number(ratio?.lt) || 0);
  const sum = un + rt + lt;
  if (sum === 0) return { ratioStr: '0 : 0 : 0', unPct: 0, rtPct: 0, ltPct: 0, unCount: 0, rtCount: 0, ltCount: 0 };
  const unPct = Number(((un / sum) * 100).toFixed(1));
  const rtPct = Number(((rt / sum) * 100).toFixed(1));
  const ltPct = Number(((lt / sum) * 100).toFixed(1));
  const unCount = Math.round((un / sum) * totalRings);
  const rtCount = Math.round((rt / sum) * totalRings);
  const ltCount = Math.max(0, totalRings - unCount - rtCount);
  return { ratioStr: `${un} : ${rt} : ${lt}`, unPct, rtPct, ltPct, unCount, rtCount, ltCount };
}

/**
 * Automatically finds the best UN:RT:LT ratio for a given section
 * Respects allowedTypes strictly (e.g. if UN is forbidden, sets un: 0).
 */
export function findBestRatioForSection(section, startKey = 'U4', startH = -20, startV = -10, limit = 55.0) {
  const allowed = Array.isArray(section.allowedTypes) && section.allowedTypes.length > 0
    ? section.allowedTypes
    : ['U', 'R', 'L'];

  const allowU = allowed.includes('U');
  const allowR = allowed.includes('R');
  const allowL = allowed.includes('L');

  if (section.sectionType === 'tangent' || section.direction === 'straight') {
    if (allowU) return { un: 1, rt: 0, lt: 0 };
    if (allowR && allowL) return { un: 0, rt: 1, lt: 1 };
    return { un: allowU ? 1 : 0, rt: allowR ? 1 : 0, lt: allowL ? 1 : 0 };
  }

  const isRight = section.direction === 'right';

  // Base raw candidates
  const rawCandidates = isRight ? [
    { un: 1, rt: 0, lt: 0 },
    { un: 6, rt: 1, lt: 0 },
    { un: 5, rt: 1, lt: 0 },
    { un: 4, rt: 1, lt: 0 },
    { un: 3, rt: 1, lt: 0 },
    { un: 2, rt: 1, lt: 0 },
    { un: 3, rt: 2, lt: 0 },
    { un: 1, rt: 1, lt: 0 },
    { un: 1, rt: 2, lt: 0 },
    { un: 0, rt: 1, lt: 0 },
    { un: 0, rt: 23, lt: 13 },
  ] : [
    { un: 1, rt: 0, lt: 0 },
    { un: 6, rt: 0, lt: 1 },
    { un: 5, rt: 0, lt: 1 },
    { un: 4, rt: 0, lt: 1 },
    { un: 3, rt: 0, lt: 1 },
    { un: 2, rt: 0, lt: 1 },
    { un: 3, rt: 0, lt: 2 },
    { un: 1, rt: 0, lt: 1 },
    { un: 1, rt: 0, lt: 2 },
    { un: 0, rt: 0, lt: 1 },
    { un: 0, rt: 13, lt: 23 },
  ];

  // Filter candidates to strictly match allowed segment types
  const candidates = rawCandidates
    .map((c) => ({
      un: allowU ? c.un : 0,
      rt: allowR ? c.rt : 0,
      lt: allowL ? c.lt : 0,
    }))
    .filter((c) => (c.un + c.rt + c.lt) > 0);

  if (candidates.length === 0) {
    return { un: allowU ? 1 : 0, rt: allowR ? 1 : 0, lt: allowL ? 1 : 0 };
  }

  let bestRatio = candidates[0];
  let bestScore = Infinity;

  for (const ratio of candidates) {
    const testSec = { ...section, ratio, allowedTypes: allowed };
    const res = runAdvancePlan({
      sections: [testSec],
      startKey,
      startHLead: startH,
      startVLead: startV,
      maxTolerance: limit,
      startRingNumber: 1
    });

    const score = (res.violationCount * 1000) + res.maxObservedLead;
    if (score < bestScore) {
      bestScore = score;
      bestRatio = ratio;
    }
  }
  
  return bestRatio;
}

/**
 * ============================================================================
 * ADVANCE PLANNER V2: STA-Driven + Segment Restrictions + Vertical Alignment
 * ============================================================================
 */
export function runAdvancePlan({
  sections = DEFAULT_ALIGNMENT_SECTIONS,
  verticalAlignment = DEFAULT_VERTICAL_ALIGNMENT,
  startKey = 'U4',
  startHLead = -20.0,
  startVLead = -10.0,
  maxTolerance = 55.0,
  startRingNumber = 1,
}) {
  const limit = Math.abs(Number(maxTolerance)) || 55.0;
  let currentKey = startKey || 'U4';
  let currentH = Number(startHLead);
  if (isNaN(currentH)) currentH = -20.0;
  let currentV = Number(startVLead);
  if (isNaN(currentV)) currentV = -10.0;

  const allPlannedRings = [];
  const violations = [];
  let globalRingIndex = 0;
  let currentRingNumber = Number(startRingNumber) || 1;

  let dtaX = 0, dtaY = 0, dtaTheta = 0;
  let tbmX = 0, tbmY = 0, tbmTheta = 0;

  sections.forEach((sec) => {
    const startMeters = parseSTA(sec.startSTA);
    const endMeters = parseSTA(sec.endSTA);
    const totalDistance = Math.abs(endMeters - startMeters);
    const isDecreasingSTA = endMeters < startMeters;

    if (totalDistance < 0.1) return;

    // Segment Allowed Types (e.g. ['U', 'R'] -> forbid 'L')
    const allowedTypes = Array.isArray(sec.allowedTypes) && sec.allowedTypes.length > 0
      ? sec.allowedTypes
      : ['U', 'R', 'L'];

    const allowU = allowedTypes.includes('U');
    const allowR = allowedTypes.includes('R');
    const allowL = allowedTypes.includes('L');

    const un = allowU ? Math.max(0, Number(sec.ratio?.un) || 0) : 0;
    const rt = allowR ? Math.max(0, Number(sec.ratio?.rt) || 0) : 0;
    const lt = allowL ? Math.max(0, Number(sec.ratio?.lt) || 0) : 0;
    const ratioSum = un + rt + lt;
    const targetUnPct = ratioSum > 0 ? un / ratioSum : (allowU ? 1 : 0);
    const targetRtPct = ratioSum > 0 ? rt / ratioSum : (allowR ? 1 : 0);
    const targetLtPct = ratioSum > 0 ? lt / ratioSum : (allowL ? 1 : 0);

    let sectionRingIndex = 0;
    let sectionUsed = { U: 0, R: 0, L: 0 };
    let coveredDistance = 0;
    let currentSTAMeters = startMeters;

    const maxRingsPerSection = 500;

    while (coveredDistance < totalDistance - 0.01 && sectionRingIndex < maxRingsPerSection) {
      globalRingIndex++;
      sectionRingIndex++;
      const ringNumFormatted = `R${String(currentRingNumber).padStart(4, '0')}`;
      const beforePos = KEY_DATA[currentKey]?.pos || parseInt(currentKey.replace(/\D/g, '') || '1', 10);

      // STRICT FILTER: Filter candidate keys by allowedTypes
      let availableCandidates = (NEXT_RING_TABLE[currentKey] || Object.keys(KEY_DATA))
        .filter((candKey) => {
          const t = KEY_DATA[candKey]?.type || candKey.charAt(0);
          return allowedTypes.includes(t);
        });

      // Fallback if no allowed candidate exists from currentKey
      if (availableCandidates.length === 0) {
        availableCandidates = Object.keys(KEY_DATA).filter((k) => allowedTypes.includes(KEY_DATA[k]?.type || k.charAt(0)));
      }
      if (availableCandidates.length === 0) {
        availableCandidates = NEXT_RING_TABLE[currentKey] || Object.keys(KEY_DATA);
      }

      const distanceProgress = Math.min(1.0, coveredDistance / totalDistance);

      // Find matching vertical alignment element for this STA
      const matchingVElem = verticalAlignment?.find((v) => {
        const vStart = parseSTA(v.startSTA);
        const vEnd = parseSTA(v.endSTA);
        const minSTA = Math.min(vStart, vEnd);
        const maxSTA = Math.max(vStart, vEnd);
        return currentSTAMeters >= minSTA - 0.1 && currentSTAMeters <= maxSTA + 0.1;
      });

      const totalSoFar = sectionUsed.U + sectionUsed.R + sectionUsed.L;
      const currentUnPct = totalSoFar > 0 ? sectionUsed.U / totalSoFar : 0;
      const currentRtPct = totalSoFar > 0 ? sectionUsed.R / totalSoFar : 0;
      const currentLtPct = totalSoFar > 0 ? sectionUsed.L / totalSoFar : 0;

      const evaluatedCandidates = availableCandidates.map((candKey) => {
        const candData = KEY_DATA[candKey] || { hLead: 0, vLead: 0, pos: 1, type: candKey.charAt(0) };
        const candType = candData.type;
        const candSize = SEGMENT_SIZES[candType] || 1400;
        const candDistM = candSize / 1000;

        const wouldOvershoot = (coveredDistance + candDistM) > (totalDistance + 0.5);

        // Horizontal Steering Lead Required
        const leadReq = calculateSectionLeadRequired({
          sectionType: sec.sectionType,
          direction: sec.direction,
          radius: sec.radius,
          segSizeMm: candSize,
          distanceProgress,
        });

        // Vertical Steering Lead Required
        const vLeadReq = calculateVerticalLeadRequired(matchingVElem, candSize);

        const afterH = Number((candData.hLead + currentH + leadReq).toFixed(2));
        const afterV = Number((candData.vLead + currentV + vLeadReq).toFixed(2));

        const suitability = SUITABILITY_MATRIX[beforePos]?.[candData.pos] || 'Fair';

        const exceedsLimit = Math.abs(afterH) > limit || Math.abs(afterV) > limit;
        const overLimitAmount = Math.max(0, Math.abs(afterH) - limit, Math.abs(afterV) - limit);

        // === SCORING ===
        let suitScore = suitability === 'Yes' ? 200 : suitability === 'Fair' ? 80 : -600;

        let hScore = 0;
        if (sec.direction === 'right') {
          if (afterH >= -52 && afterH <= -15) {
            hScore = 80 - Math.abs(afterH + 35) * 0.8;
          } else {
            hScore = -Math.abs(afterH + 35) * 1.8;
          }
        } else if (sec.direction === 'left') {
          if (afterH >= 15 && afterH <= 52) {
            hScore = 80 - Math.abs(afterH - 35) * 0.8;
          } else {
            hScore = -Math.abs(afterH - 35) * 1.8;
          }
        } else {
          hScore = 60 - Math.abs(afterH) * 3;
        }

        const vScore = 60 - Math.abs(afterV) * 0.8;

        let ratioScore = 0;
        const targetPctForType = candType === 'U' ? targetUnPct : candType === 'R' ? targetRtPct : targetLtPct;
        if (targetPctForType === 0) {
          ratioScore = -400;
        } else if (totalSoFar > 0) {
          const currentPctForType = candType === 'U' ? currentUnPct : candType === 'R' ? currentRtPct : currentLtPct;
          const deficit = targetPctForType - currentPctForType;
          ratioScore = deficit * 400;
        } else {
          ratioScore = targetPctForType * 100;
        }

        const limitPenalty = exceedsLimit ? overLimitAmount * 12 : 0;
        const overshootPenalty = wouldOvershoot ? 300 : 0;

        const totalScore = Number((suitScore + hScore + vScore + ratioScore - limitPenalty - overshootPenalty).toFixed(2));

        return {
          key: candKey, type: candType, size: candSize,
          sizeM: (candSize / 1000).toFixed(1),
          segHLead: candData.hLead, segVLead: candData.vLead,
          leadReq, vLeadReq, afterH, afterV, suitability,
          exceedsLimit, overLimitAmount: Number(overLimitAmount.toFixed(2)),
          totalScore, wouldOvershoot,
        };
      });

      evaluatedCandidates.sort((a, b) => b.totalScore - a.totalScore);
      const chosen = evaluatedCandidates[0];

      sectionUsed[chosen.type]++;

      if (chosen.exceedsLimit) {
        violations.push({
          step: globalRingIndex, ringNum: ringNumFormatted,
          sectionCode: sec.code, afterH: chosen.afterH, afterV: chosen.afterV,
          limit, overAmount: chosen.overLimitAmount,
        });
      }

      const currentRingSTA = formatSTA(currentSTAMeters);
      const ringDistM = chosen.size / 1000;
      const prevDtaX = dtaX;
      const prevDtaY = dtaY;
      const prevTbmX = tbmX;
      const prevTbmY = tbmY;

      let dtaCurvature = 0;
      if (sec.direction !== 'straight' && sec.sectionType !== 'tangent' && sec.radius > 0) {
        const signDir = sec.direction === 'right' ? 1 : -1;
        if (sec.sectionType === 'full_curve') {
          dtaCurvature = (1 / sec.radius) * signDir;
        } else if (sec.sectionType === 'transition_in') {
          dtaCurvature = (distanceProgress / sec.radius) * signDir;
        } else if (sec.sectionType === 'transition_out') {
          dtaCurvature = ((1 - distanceProgress) / sec.radius) * signDir;
        }
      }
      dtaTheta += dtaCurvature * ringDistM;
      dtaX += ringDistM * Math.sin(dtaTheta);
      dtaY += ringDistM * Math.cos(dtaTheta);

      const tbmTurnAngle = (-1 * chosen.segHLead) / TBM_DIAMETER_MM;
      tbmTheta += tbmTurnAngle;
      tbmX += ringDistM * Math.sin(tbmTheta);
      tbmY += ringDistM * Math.cos(tbmTheta);

      const deviationMm = Number(((tbmX - dtaX) * 1000).toFixed(1));

      allPlannedRings.push({
        step: globalRingIndex,
        ringNum: ringNumFormatted, ringNumInt: currentRingNumber,
        sta: currentRingSTA, dist: Number(coveredDistance.toFixed(1)),
        sectionCode: sec.code, sectionName: sec.name, sectionType: sec.sectionType,
        prevKey: currentKey, selectedKey: chosen.key,
        type: chosen.type, size: chosen.size, sizeM: chosen.sizeM,
        segHLead: chosen.segHLead, segVLead: chosen.segVLead,
        leadReq: chosen.leadReq, vLeadReq: chosen.vLeadReq,
        afterH: chosen.afterH, afterV: chosen.afterV,
        suitability: chosen.suitability,
        exceedsLimit: chosen.exceedsLimit, overLimitAmount: chosen.overLimitAmount,
        startX: Number(prevTbmX.toFixed(3)),
        startY: Number(prevTbmY.toFixed(3)),
        endX: Number(tbmX.toFixed(3)),
        endY: Number(tbmY.toFixed(3)),
        theta: Number(tbmTheta.toFixed(4)),
        dtaStartX: Number(prevDtaX.toFixed(3)),
        dtaStartY: Number(prevDtaY.toFixed(3)),
        dtaEndX: Number(dtaX.toFixed(3)),
        dtaEndY: Number(dtaY.toFixed(3)),
        dtaTheta: Number(dtaTheta.toFixed(4)),
        dtaX: Number(dtaX.toFixed(3)), dtaY: Number(dtaY.toFixed(3)),
        tbmX: Number(tbmX.toFixed(3)), tbmY: Number(tbmY.toFixed(3)),
        deviationMm,
        gapT: 90, gapB: 90, gapL: 90, gapR: 90,
        notes: `Sec ${sec.code} [STA ${currentRingSTA}] H:${chosen.afterH} V:${chosen.afterV}`,
      });

      if (isDecreasingSTA) { currentSTAMeters -= ringDistM; } else { currentSTAMeters += ringDistM; }
      coveredDistance += ringDistM;

      currentKey = chosen.key;
      currentH = chosen.afterH;
      currentV = chosen.afterV;
      currentRingNumber++;
    }
  });

  const totalRings = allPlannedRings.length;
  let maxObservedLead = 0, maxDeviationMm = 0;
  let unCount = 0, rtCount = 0, ltCount = 0;

  allPlannedRings.forEach((r) => {
    const leadMag = Math.max(Math.abs(r.afterH), Math.abs(r.afterV));
    if (leadMag > maxObservedLead) maxObservedLead = leadMag;
    if (Math.abs(r.deviationMm) > Math.abs(maxDeviationMm)) maxDeviationMm = r.deviationMm;
    if (r.type === 'U') unCount++;
    else if (r.type === 'R') rtCount++;
    else if (r.type === 'L') ltCount++;
  });

  const violationCount = violations.length;
  let verdictStatus, verdictMessage;
  const diagnosticAdvice = [];

  if (violationCount === 0) {
    verdictStatus = 'OPTIMAL';
    verdictMessage = `แผนสมบูรณ์ — ${totalRings} ริง (UN:${unCount} RT:${rtCount} LT:${ltCount}) ค่า Lead/Plumb อยู่ในเกณฑ์ ±${limit} mm`;
    diagnosticAdvice.push('ค่า Lead ทุกช่วงเกาะตามแนวเส้นได้ดี');
  } else if (violationCount <= Math.max(10, totalRings * 0.15) && maxObservedLead <= limit + 20) {
    verdictStatus = 'WARNING';
    verdictMessage = `แผนใช้งานได้ดี — ${totalRings} ริง มีค่าเกินเกณฑ์เล็กน้อย ${violationCount} ริง (สูงสุด ${maxObservedLead.toFixed(1)} mm)`;
    diagnosticAdvice.push(`ในโค้งรัศมีแคบ การที่ค่าแตะ ${Math.ceil(maxObservedLead)} mm ชั่วคราวเป็นพฤติกรรมปกติ`);
  } else {
    verdictStatus = 'INFEASIBLE';
    verdictMessage = `อัตราส่วนนี้ไม่เหมาะ — Lead เกินเกณฑ์ ${violationCount} ริง (สูงสุด ${maxObservedLead.toFixed(1)} mm)`;
    diagnosticAdvice.push('แนะนำให้ปรับอัตราส่วน หรือใช้ปุ่ม Auto-Optimize');
  }

  return {
    sections, totalRings, maxTolerance: limit,
    maxObservedLead: Number(maxObservedLead.toFixed(2)),
    maxDeviationMm: Number(maxDeviationMm.toFixed(1)),
    violationCount,
    verdict: { status: verdictStatus, message: verdictMessage, advice: diagnosticAdvice },
    counts: { un: unCount, rt: rtCount, lt: ltCount },
    plannedRings: allPlannedRings,
    violations,
  };
}

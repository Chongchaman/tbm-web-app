import { KEY_DATA, NEXT_RING_TABLE, SUITABILITY_MATRIX } from '../data/tbmConstants.js';

/**
 * Calculate Lead Request according to project specification:
 * Lead request = 6300 * Segment Length / (Curve Radius * 1000)
 * Right curve (+) : Positive
 * Left curve (-)  : Negative
 * Straight (0)    : Zero
 */
export function calculateLeadRequest({ alignmentType = 'straight', radius = 500, segWidth = 1400 }) {
  if (alignmentType === 'straight' || !radius || radius <= 0) {
    return 0;
  }
  const rawLead = (6300 * Number(segWidth)) / (Number(radius) * 1000);
  if (alignmentType === 'right') {
    return Number(rawLead.toFixed(2));
  } else if (alignmentType === 'left') {
    return Number((-1 * rawLead).toFixed(2));
  }
  return 0;
}

/**
 * Automated Multi-Ring Planning & Sequencing Engine
 */
export function runAutoPlan({
  startRingNum = 'R0016',
  startKey = 'L2',
  startHLead = 38.39,
  startVLead = 32.47,
  alignmentType = 'straight', // 'straight' | 'right' | 'left'
  radius = 500,
  segWidth = 1400,
  ringCount = 10,
  targetV = 0,
}) {
  const count = Math.max(1, Math.min(100, Number(ringCount) || 10));
  const leadRequest = calculateLeadRequest({ alignmentType, radius, segWidth });

  let currentKey = startKey || 'L2';
  let currentH = Number(startHLead) || 0;
  let currentV = Number(startVLead) || 0;
  
  // Extract numerical starting index from ring number (e.g. 'R0016' -> 16)
  const matchNum = String(startRingNum).match(/\d+/);
  let baseRingIndex = matchNum ? parseInt(matchNum[0], 10) : 16;
  const numPrefix = String(startRingNum).replace(/\d+/, '') || 'R';
  const numPadLen = matchNum ? matchNum[0].length : 4;

  const plannedRings = [];

  for (let step = 1; step <= count; step++) {
    const ringNumberFormatted = `${numPrefix}${String(baseRingIndex + step - 1).padStart(numPadLen, '0')}`;
    const beforePos = KEY_DATA[currentKey]?.pos || parseInt(currentKey.replace(/\D/g, '') || '1', 10);
    const candidateKeys = NEXT_RING_TABLE[currentKey] || Object.keys(KEY_DATA);

    // Evaluate all candidates
    const scoredCandidates = candidateKeys.map((candKey) => {
      const candData = KEY_DATA[candKey] || { hLead: 0, vLead: 0, pos: 1, type: candKey.charAt(0) };
      const candPos = candData.pos;

      // Resulting lead if this candidate is installed
      const afterH = Number((candData.hLead + currentH + leadRequest).toFixed(2));
      const afterV = Number((candData.vLead + currentV).toFixed(2));

      // Suitability check from Matrix
      const suitability = SUITABILITY_MATRIX[beforePos]?.[candPos] || 'Fair';

      // Drift from target (Target H is 0 deviation from alignment lead request, Target V is targetV)
      const driftH = afterH - leadRequest;
      const driftV = afterV - targetV;
      const totalDrift = Number(Math.hypot(driftH, driftV).toFixed(2));

      // Scoring
      let suitScore = suitability === 'Yes' ? 120 : suitability === 'Fair' ? 60 : -100;
      
      // Bonus for alternating ring type (R <-> L) to prevent roll & taper accumulation
      const isCrossType = currentKey.charAt(0) !== candData.type && candData.type !== 'U';
      const crossBonus = isCrossType ? 15 : 0;

      const totalScore = Number((suitScore + crossBonus - totalDrift * 0.8).toFixed(2));

      return {
        key: candKey,
        type: candData.type,
        pos: candPos,
        segHLead: candData.hLead,
        segVLead: candData.vLead,
        afterH,
        afterV,
        suitability,
        totalDrift,
        totalScore,
      };
    });

    // Sort to find the best candidate
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
    const bestCand = scoredCandidates[0];

    // Push into planned plan
    plannedRings.push({
      step,
      ringNum: ringNumberFormatted,
      prevKey: currentKey,
      selectedKey: bestCand.key,
      type: bestCand.type,
      segHLead: bestCand.segHLead,
      segVLead: bestCand.segVLead,
      afterH: bestCand.afterH,
      afterV: bestCand.afterV,
      targetH: leadRequest,
      targetV: targetV,
      driftH: Number((bestCand.afterH - leadRequest).toFixed(2)),
      driftV: Number((bestCand.afterV - targetV).toFixed(2)),
      totalDrift: bestCand.totalDrift,
      suitability: bestCand.suitability,
      gapT: 90,
      gapB: 90,
      gapL: 90,
      gapR: 90,
      notes: `Auto Planned (Step ${step}) [Lead Req: ${leadRequest > 0 ? '+' : ''}${leadRequest} mm]`,
    });

    // Advance state to next iteration
    currentKey = bestCand.key;
    currentH = bestCand.afterH;
    currentV = bestCand.afterV;
  }

  // Summary Metrics
  let maxDrift = 0;
  let sumDrift = 0;
  let rCount = 0;
  let lCount = 0;
  let uCount = 0;

  plannedRings.forEach((r) => {
    if (r.totalDrift > maxDrift) maxDrift = r.totalDrift;
    sumDrift += r.totalDrift;
    if (r.type === 'R') rCount++;
    else if (r.type === 'L') lCount++;
    else if (r.type === 'U') uCount++;
  });

  const avgDrift = Number((sumDrift / count).toFixed(2));
  const totalDistanceM = Number(((count * Number(segWidth)) / 1000).toFixed(1));

  return {
    leadRequest,
    alignmentType,
    radius: Number(radius),
    segWidth: Number(segWidth),
    ringCount: count,
    totalDistanceM,
    maxDrift,
    avgDrift,
    rCount,
    lCount,
    uCount,
    plannedRings,
  };
}

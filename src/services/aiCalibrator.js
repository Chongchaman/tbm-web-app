/**
 * ============================================================================
 * AI CALIBRATOR — Adaptive Weight Calibration from Ring Log History
 * ============================================================================
 * Analyzes past ring log data to calibrate AI scoring weights.
 * The more data the system collects, the smarter it becomes.
 */

/**
 * AI Confidence Level based on ring log count
 */
export function getAIConfidenceLevel(ringCount) {
  if (ringCount >= 500) return { level: 'master', label: '🏆 Master (500+ ริง)', pct: 100, color: '#10b981' };
  if (ringCount >= 200) return { level: 'expert', label: '🧠 Expert (200+ ริง)', pct: 85, color: '#06b6d4' };
  if (ringCount >= 100) return { level: 'proficient', label: '📈 Proficient (100+ ริง)', pct: 70, color: '#8b5cf6' };
  if (ringCount >= 50)  return { level: 'intermediate', label: '📊 Intermediate (50+ ริง)', pct: 55, color: '#f59e0b' };
  if (ringCount >= 10)  return { level: 'novice', label: '🌱 Novice (10+ ริง)', pct: 30, color: '#ef4444' };
  return { level: 'untrained', label: '⚪ ยังไม่มีข้อมูล', pct: 10, color: '#6b7280' };
}

/**
 * Default AI weights (used when no calibration data is available)
 */
export const DEFAULT_AI_WEIGHTS = {
  Kp: 0.40,
  Kd: 1200.0,
  hScoreCoeff: 2.5,
  vScoreCoeff: 2.0,
  gapCriticalPenalty: -6000.0,
  gapWarnPenalty: -1800.0,
  suitYes: 300,
  suitFair: 100,
  suitNo: -1500,
  articulationSoftLimit: 0.35,
  articulationHardLimit: 0.50,
  beamSearchDepth: 3,
  beamSearchWidth: 3,
  driftTrendWindow: 5,
  transitionBlendZone: 6.0,
};

/**
 * Analyze ring log data and produce calibrated weights
 */
export function calibrateFromRingLogs(ringLogs = []) {
  if (!ringLogs || ringLogs.length < 10) {
    return { ...DEFAULT_AI_WEIGHTS, calibrated: false, sampleSize: ringLogs?.length || 0 };
  }

  const n = ringLogs.length;
  const hLeads = ringLogs.map(r => Number(r.hLead) || 0);
  const vLeads = ringLogs.map(r => Number(r.vLead) || 0);

  const avgAbsH = hLeads.reduce((s, h) => s + Math.abs(h), 0) / n;
  const avgAbsV = vLeads.reduce((s, v) => s + Math.abs(v), 0) / n;
  const maxAbsH = Math.max(...hLeads.map(h => Math.abs(h)));
  const maxAbsV = Math.max(...vLeads.map(v => Math.abs(v)));

  let hVolatility = 0;
  let vVolatility = 0;
  for (let i = 1; i < n; i++) {
    hVolatility += Math.pow(hLeads[i] - hLeads[i-1], 2);
    vVolatility += Math.pow(vLeads[i] - vLeads[i-1], 2);
  }
  hVolatility = Math.sqrt(hVolatility / (n - 1));
  vVolatility = Math.sqrt(vVolatility / (n - 1));

  const weights = { ...DEFAULT_AI_WEIGHTS };

  if (hVolatility > 30) {
    weights.Kd = Math.min(2000, DEFAULT_AI_WEIGHTS.Kd * (1 + (hVolatility - 30) / 60));
  }
  if (avgAbsH > 35) {
    weights.Kp = Math.min(0.60, DEFAULT_AI_WEIGHTS.Kp * (1 + (avgAbsH - 35) / 40));
  }
  if (avgAbsV > 30) {
    weights.vScoreCoeff = Math.min(3.5, DEFAULT_AI_WEIGHTS.vScoreCoeff * (1 + (avgAbsV - 30) / 50));
  }
  if (maxAbsH > 48 || maxAbsV > 48) {
    weights.hScoreCoeff = Math.min(4.0, DEFAULT_AI_WEIGHTS.hScoreCoeff * 1.3);
  }

  const confidenceFactor = Math.min(1.0, n / 300);
  for (const key of Object.keys(weights)) {
    if (typeof weights[key] === 'number' && typeof DEFAULT_AI_WEIGHTS[key] === 'number') {
      weights[key] = DEFAULT_AI_WEIGHTS[key] * (1 - confidenceFactor) + weights[key] * confidenceFactor;
    }
  }

  return {
    ...weights,
    calibrated: true,
    sampleSize: n,
    stats: {
      avgAbsH: Number(avgAbsH.toFixed(1)),
      avgAbsV: Number(avgAbsV.toFixed(1)),
      maxAbsH: Number(maxAbsH.toFixed(1)),
      maxAbsV: Number(maxAbsV.toFixed(1)),
      hVolatility: Number(hVolatility.toFixed(1)),
      vVolatility: Number(vVolatility.toFixed(1)),
    }
  };
}

/**
 * Compute adaptive weights: use calibrated if available, otherwise defaults
 */
export function getAdaptiveWeights(ringLogs = []) {
  return calibrateFromRingLogs(ringLogs);
}

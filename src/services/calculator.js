import { KEY_DATA, NEXT_RING_TABLE, SUITABILITY_MATRIX, TBM_SPECS } from '../data/tbmConstants.js';

/**
 * Calculate Articulation Angle from Curve Radius
 * Formula: ASIN(9.98 / (2 * R)) * (180 / PI)
 */
export function calculateArticulation(radius) {
  if (!radius || radius <= 0) return 0;
  const sinVal = TBM_SPECS.ARTICULATION_DISTANCE / (radius * 2);
  if (sinVal > 1) return 90;
  return (Math.asin(sinVal) * (180 / Math.PI));
}

/**
 * Calculate Curve H & V Lead offset
 * Formula: H = (6300 * Width) / (Radius * 1000) * (dir === 'R' ? 1 : -1)
 */
export function calculateCurveOffset(radius, width = 1400, dir = 'R') {
  if (!radius || radius <= 0) {
    return { hLead: 0, vLead: 0, articulation: 0 };
  }
  const factor = dir === 'R' ? 1 : -1;
  const hLead = Number(((6300 * width) / (radius * 1000) * factor).toFixed(2));
  const vLead = Number(((-1 * 6300 * width) / (radius * 1000) * factor).toFixed(2));
  const articulation = Number(calculateArticulation(radius).toFixed(4));
  return { hLead, vLead, articulation };
}

/**
 * Calculate Candidate Next Keys with Lead sums, Suitability, Drift, and Ranking
 */
export function calculateCandidates({
  beforeKey = 'R13',
  beforeHLead = 0,
  beforeVLead = 0,
  curveHLead = 0,
  curveVLead = 0,
  targetH = 0,
  targetV = 0,
}) {
  const bKey = beforeKey || 'R13';
  const candidateKeyList = NEXT_RING_TABLE[bKey] || Object.keys(KEY_DATA);
  const beforePos = KEY_DATA[bKey]?.pos || parseInt(bKey.replace(/\D/g, '') || '1', 10);
  const bH = Number(beforeHLead) || 0;
  const bV = Number(beforeVLead) || 0;
  const cH = Number(curveHLead) || 0;
  const cV = Number(curveVLead) || 0;

  const candidates = candidateKeyList.map((candKey) => {
    const data = KEY_DATA[candKey] || { hLead: 0, vLead: 0, pos: 1, type: candKey.charAt(0) };
    const candPos = data.pos;
    
    // Resulting lead: Segment Lead + Before Lead + Curve Lead
    const afterHLead = Number((data.hLead + bH + cH).toFixed(2));
    const afterVLead = Number((data.vLead + bV + cV).toFixed(2));

    // Suitability check
    const suitability = SUITABILITY_MATRIX[beforePos]?.[candPos] || 'Fair';

    // Distance / Drift to target
    const drift = Number(Math.hypot(afterHLead - targetH, afterVLead - targetV).toFixed(2));

    // Score calculation (Lower drift and higher suitability = better rank)
    let suitScore = suitability === 'Yes' ? 100 : suitability === 'Fair' ? 60 : 10;
    const rankScore = Number((suitScore - drift * 0.5).toFixed(2));

    return {
      key: candKey,
      type: data.type,
      pos: candPos,
      segHLead: data.hLead,
      segVLead: data.vLead,
      afterHLead,
      afterVLead,
      suitability,
      drift,
      rankScore,
      angle: data.angle,
    };
  });

  // Sort by rank score descending (Best recommendation first)
  candidates.sort((a, b) => b.rankScore - a.rankScore);

  return candidates;
}

/**
 * Dynamic Taper geometry calculation for Key 1..16 with Roll adjustment
 */
export function calculateTaperGeometry(maxTaper = 60.0, od = 6000.0, rollDeg = 0.0) {
  const result = [];
  for (let p = 1; p <= 16; p++) {
    const baseAngle = (p - 1) * 22.5;
    let locAngle = (baseAngle + Number(rollDeg)) % 360;
    if (locAngle < 0) locAngle += 360;
    const rad = (locAngle * Math.PI) / 180;

    const hCalc = -Math.cos(rad) * (od / 2);
    const vCalc = Math.sin(rad) * (od / 2);

    const hTaper = (maxTaper / 2) * (hCalc / od) * 2;
    const vTaper = (maxTaper / 2) * (vCalc / od) * 2;

    const rH = Number((hTaper * 2).toFixed(2));
    const rV = Number((vTaper * 2).toFixed(2));
    const lH = Number((-hTaper * 2).toFixed(2));
    const lV = Number((vTaper * 2).toFixed(2));

    result.push({
      pos: p,
      baseAngle,
      locAngle: Number(locAngle.toFixed(2)),
      hCalc: Number(hCalc.toFixed(2)),
      vCalc: Number(vCalc.toFixed(2)),
      hTaper: Number(hTaper.toFixed(2)),
      vTaper: Number(vTaper.toFixed(2)),
      rLeadH: rH,
      rLeadV: rV,
      lLeadH: lH,
      lLeadV: lV,
    });
  }
  return result;
}

/**
 * TBM Foam & Soil Conditioning Calculator
 */
export function calculateFoamConsumption({
  tbmDia = 6610,
  segWidth = 1400,
  jackSpeed = 40,
  foamDosage = 1.0,       // %
  earthPressure = 0.2,    // MPa
  atmPressure = 0.101325, // MPa
  fir = 15.0,             // % (Foam Injection Ratio)
  fer = 8.0,              // times (Foam Expansion Ratio)
}) {
  const sectionArea = (Math.PI * Math.pow(tbmDia / 1000, 2)) / 4;
  const soilPerRing = sectionArea * (segWidth / 1000);
  const excavationTime = segWidth / jackSpeed;
  const dischargeSoilFlowM3Min = sectionArea * (jackSpeed / 1000);
  const dischargeSoilFlowLMin = dischargeSoilFlowM3Min * 1000;

  const foamInChamberLMin = dischargeSoilFlowLMin * (fir / 100);
  const foamSolutionLMin = foamInChamberLMin / fer;
  const foamAgentLMin = foamSolutionLMin * (foamDosage / 100);
  const waterLMin = foamSolutionLMin - foamAgentLMin;

  const airAtAtmNLMin =
    foamInChamberLMin * ((fer - 1) / fer) * ((atmPressure + earthPressure) / atmPressure);
  const airAtPressureLMin = foamInChamberLMin - foamSolutionLMin;

  // Ring volume
  const foamAgentPerRing = foamAgentLMin * excavationTime;
  const foamSolutionPerRing = foamSolutionLMin * excavationTime;
  const waterPerRing = waterLMin * excavationTime;
  const airAtAtmPerRing = airAtAtmNLMin * excavationTime;
  const foamInChamberPerRing = foamInChamberLMin * excavationTime;
  const airAtPressurePerRing = airAtPressureLMin * excavationTime;

  // Usage ratios
  const foamAgentPerMeter = foamAgentPerRing / (segWidth / 1000);
  const foamAgentPerM3Soil = foamAgentPerRing / soilPerRing;

  // Per port (3 ports)
  const foamSolutionPerPort = foamSolutionLMin / 3;
  const airAtAtmPerPort = airAtAtmNLMin / 3;

  return {
    sectionArea: Number(sectionArea.toFixed(4)),
    soilPerRing: Number(soilPerRing.toFixed(3)),
    excavationTime: Number(excavationTime.toFixed(1)),
    dischargeSoilFlowM3Min: Number(dischargeSoilFlowM3Min.toFixed(4)),
    dischargeSoilFlowLMin: Number(dischargeSoilFlowLMin.toFixed(2)),
    flowRates: {
      foamAgentLMin: Number(foamAgentLMin.toFixed(3)),
      foamSolutionLMin: Number(foamSolutionLMin.toFixed(2)),
      waterLMin: Number(waterLMin.toFixed(2)),
      foamInChamberLMin: Number(foamInChamberLMin.toFixed(2)),
      airAtAtmNLMin: Number(airAtAtmNLMin.toFixed(2)),
      airAtPressureLMin: Number(airAtPressureLMin.toFixed(2)),
    },
    perRing: {
      foamAgentL: Number(foamAgentPerRing.toFixed(2)),
      foamSolutionL: Number(foamSolutionPerRing.toFixed(2)),
      waterL: Number(waterPerRing.toFixed(2)),
      foamInChamberL: Number(foamInChamberPerRing.toFixed(2)),
      airAtAtmNL: Number(airAtAtmPerRing.toFixed(1)),
      airAtPressureL: Number(airAtPressurePerRing.toFixed(1)),
    },
    metrics: {
      foamAgentPerMeter: Number(foamAgentPerMeter.toFixed(2)),
      foamAgentPerM3Soil: Number(foamAgentPerM3Soil.toFixed(4)),
    },
    perPort: {
      foamSolutionL: Number(foamSolutionPerPort.toFixed(2)),
      airAtAtmNL: Number(airAtAtmPerPort.toFixed(2)),
    },
  };
}

/**
 * TBM Polymer Soil Conditioning Calculator (Alfa-G Polymer)
 */
export function calculatePolymerConsumption({
  tbmDia = 6610,
  polymerDosage = 0.4,           // % of water volume 1 m3
  polymerSolutionInjection = 25.0, // % of excavated soil volume
  distance = 2.0,                // m
}) {
  const sectionArea = (Math.PI * Math.pow(tbmDia / 1000, 2)) / 4;
  const soilVolumePerMeter = sectionArea;
  const polymerInjectionPerMeterM3 = soilVolumePerMeter * (polymerSolutionInjection / 100);
  const polymerDosagePerMeterL = polymerInjectionPerMeterM3 * 1000 * (polymerDosage / 100);
  const totalConsumptionL = polymerDosagePerMeterL * distance;

  return {
    soilVolumePerMeter: Number(soilVolumePerMeter.toFixed(4)),
    polymerInjectionPerMeterM3: Number(polymerInjectionPerMeterM3.toFixed(4)),
    polymerDosagePerMeterL: Number(polymerDosagePerMeterL.toFixed(3)),
    distance: Number(distance),
    totalConsumptionL: Number(totalConsumptionL.toFixed(2)),
  };
}

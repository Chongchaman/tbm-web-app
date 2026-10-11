import { formatSTA, groundElevationAt, soilAt, soilSheetSections, tunnelElevationAt } from './soilProfile.js';

export const TBM_RADIUS_M = 3.305;
export const WATER_UNIT_WEIGHT = 9.81;

export const PRESSURE_DEFAULTS = Object.freeze({
  groundwaterDepth: 2,
  surcharge: 10,
  faceMargin: 20,
  faceTolerance: 15,
  groutMargin: 20,
  groutTolerance: 15,
  groutMaximum: '',
  ringWidth: 1.4,
  groutFillFactor: 115,
});

export const SOIL_PRESSURE_DEFAULTS = Object.freeze({
  S: { gammaUnsat: 17, gammaSat: 18.5, k0: 0.70 },
  M: { gammaUnsat: 18, gammaSat: 19.0, k0: 0.60 },
  C: { gammaUnsat: 19, gammaSat: 20.0, k0: 0.55 },
  A: { gammaUnsat: 18.5, gammaSat: 20.0, k0: 0.50 },
  fallback: { gammaUnsat: 18, gammaSat: 20, k0: 0.60 },
});

const finite = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const numeric = (value, fallback = 0) => finite(value) ? Number(value) : fallback;
const rounded = (value, decimals = 1) => Number(Number(value).toFixed(decimals));

export function pressureState(actual, minimum, maximum, confirmed = false) {
  if (!confirmed) return { level: 'unknown', label: 'รอยืนยันค่าควบคุม' };
  if (!finite(actual)) return { level: 'unknown', label: 'ยังไม่มีค่าจริง' };
  const value = Number(actual);
  if (value < minimum) return { level: 'critical', label: 'ต่ำกว่าเกณฑ์ · เสี่ยง Ground loss' };
  if (value > maximum) return { level: 'critical', label: 'สูงกว่าเกณฑ์ · เสี่ยง Heave/Seal' };
  const edge = Math.min(value - minimum, maximum - value);
  const width = Math.max(1, maximum - minimum);
  if (edge < width * 0.15) return { level: 'warning', label: 'ใกล้ขอบช่วงควบคุม' };
  return { level: 'normal', label: 'อยู่ในช่วงควบคุม' };
}

export function calculatePressureWindow(input) {
  const groundRL = numeric(input.groundRL);
  const axisRL = numeric(input.axisRL);
  const waterRL = numeric(input.waterRL, groundRL - numeric(input.groundwaterDepth, 2));
  const gammaUnsat = numeric(input.gammaUnsat, 18);
  const gammaSat = numeric(input.gammaSat, 20);
  const k0 = numeric(input.k0, 0.6);
  const surcharge = numeric(input.surcharge);
  const coverToAxis = Math.max(0, groundRL - axisRL);
  const dryDepth = Math.max(0, Math.min(coverToAxis, groundRL - waterRL));
  const submergedDepth = Math.max(0, coverToAxis - dryDepth);
  const porePressure = WATER_UNIT_WEIGHT * Math.max(0, waterRL - axisRL);
  const effectiveVertical = gammaUnsat * dryDepth + Math.max(0, gammaSat - WATER_UNIT_WEIGHT) * submergedDepth + surcharge;
  const totalVertical = effectiveVertical + porePressure;
  const lateralEffective = k0 * effectiveVertical;
  const equilibriumPressure = lateralEffective + porePressure;
  const faceTarget = equilibriumPressure + numeric(input.faceMargin, PRESSURE_DEFAULTS.faceMargin);
  const faceTolerance = Math.max(0, numeric(input.faceTolerance, PRESSURE_DEFAULTS.faceTolerance));
  const faceMin = Math.max(porePressure, faceTarget - faceTolerance);
  const faceMax = Math.max(faceMin, faceTarget + faceTolerance);
  const groutTarget = faceTarget + Math.max(0, numeric(input.groutMargin, PRESSURE_DEFAULTS.groutMargin));
  const groutTolerance = Math.max(0, numeric(input.groutTolerance, PRESSURE_DEFAULTS.groutTolerance));
  const requestedGroutMin = Math.max(faceTarget, groutTarget - groutTolerance);
  const requestedGroutMax = groutTarget + groutTolerance;
  const machineMaximum = finite(input.groutMaximum) ? Number(input.groutMaximum) : null;
  const groutMax = machineMaximum === null ? requestedGroutMax : Math.min(requestedGroutMax, machineMaximum);
  const groutMin = Math.min(requestedGroutMin, groutMax);
  const ringWidth = Math.max(0, numeric(input.ringWidth, PRESSURE_DEFAULTS.ringWidth));
  const theoreticalTailVoid = Math.PI / 4 * (6.61 ** 2 - 6.0 ** 2) * ringWidth;
  const groutVolumeTarget = theoreticalTailVoid * Math.max(0, numeric(input.groutFillFactor, PRESSURE_DEFAULTS.groutFillFactor)) / 100;

  return {
    coverToAxis: rounded(coverToAxis, 2),
    dryDepth: rounded(dryDepth, 2),
    submergedDepth: rounded(submergedDepth, 2),
    porePressure: rounded(porePressure),
    effectiveVertical: rounded(effectiveVertical),
    totalVertical: rounded(totalVertical),
    equilibriumPressure: rounded(equilibriumPressure),
    face: { min: rounded(faceMin), target: rounded(faceTarget), max: rounded(faceMax) },
    grout: { min: rounded(groutMin), target: rounded(groutTarget), max: rounded(groutMax), requestedMax: rounded(requestedGroutMax), machineMaximum },
    groutVolume: { theoretical: rounded(theoreticalTailVoid, 2), target: rounded(groutVolumeTarget, 2), fillFactor: numeric(input.groutFillFactor, PRESSURE_DEFAULTS.groutFillFactor) },
    warnings: [
      coverToAxis <= TBM_RADIUS_M ? 'Cover เหนือแกนอุโมงค์ต่ำกว่ารัศมี TBM ต้องตรวจเสถียรภาพเฉพาะกรณี' : null,
      machineMaximum === null ? 'ยังไม่ได้กรอกแรงดันสูงสุดจาก Tail seal, Segment และระบบ Grout' : null,
      machineMaximum !== null && machineMaximum < requestedGroutMin ? 'ค่าจำกัดเครื่องต่ำกว่าช่วง Grout ที่คำนวณ ต้องให้วิศวกรทบทวน' : null,
    ].filter(Boolean),
  };
}

export function makePressureSections(track = 'EB', saved = {}) {
  const assumptions = { ...PRESSURE_DEFAULTS, ...(saved.assumptions || {}) };
  const overrides = saved.overrides || {};
  return soilSheetSections(track).map((sheet, index) => {
    const midpoint = (sheet.start + sheet.end) / 2;
    const tunnel = tunnelElevationAt(midpoint, track);
    const ground = groundElevationAt(midpoint, track);
    const axisRL = tunnel?.elevation ?? null;
    const groundRL = ground?.elevation ?? null;
    const interpreted = axisRL === null ? null : soilAt(midpoint, track, axisRL);
    const soilCode = interpreted?.soil ? interpreted.code : 'fallback';
    const soilDefaults = SOIL_PRESSURE_DEFAULTS[soilCode] || SOIL_PRESSURE_DEFAULTS.fallback;
    const id = `${track}-${sheet.page}`;
    const override = overrides[id] || {};
    const values = {
      ...assumptions,
      ...soilDefaults,
      groundRL,
      axisRL,
      waterRL: groundRL === null ? '' : groundRL - numeric(assumptions.groundwaterDepth, 2),
      ...override,
    };
    const calculated = calculatePressureWindow(values);
    if (!interpreted?.soil) calculated.warnings.push('ชั้นดินที่ระดับแกนอุโมงค์ยังไม่ชัด ต้องตรวจ Borehole และแบบ Profile ต้นฉบับ');
    if (sheet.start >= 23300 || (sheet.start < 23300 && sheet.end > 23300)) calculated.warnings.push('พบระดับแนวกระโดดใกล้ STA 23+300 ระหว่างหน้าแบบ ต้องตรวจ Profile ต้นฉบับก่อนยืนยัน');
    return {
      id,
      index: index + 1,
      track,
      start: sheet.start,
      end: sheet.end,
      midpoint,
      startLabel: formatSTA(sheet.start),
      endLabel: formatSTA(sheet.end),
      page: sheet.page,
      drawing: sheet.drawing,
      soilCode: interpreted?.code || '?',
      soilLabel: interpreted?.soil?.label || 'ต้องตรวจแบบ',
      soilStatus: interpreted?.status || 'unknown',
      values,
      calculated,
      faceState: pressureState(override.actualFace, calculated.face.min, calculated.face.max, saved.confirmed),
      groutState: pressureState(override.actualGrout, calculated.grout.min, calculated.grout.max, saved.confirmed && calculated.grout.machineMaximum !== null),
    };
  });
}

export function sectionAtStation(sections, station) {
  const value = Number(station);
  return sections.find(section => value >= section.start && value <= section.end) || null;
}

export function toBar(kpa) {
  return finite(kpa) ? rounded(Number(kpa) / 100, 2) : null;
}

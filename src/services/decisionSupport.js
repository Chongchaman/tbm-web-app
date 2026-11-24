import { KEY_DATA, INITIAL_RING_LOGS } from '../data/tbmConstants.js';

export const DEFAULT_LIMITS = { lead: 55, deviation: 75, gapWarning: 15, gapCritical: 5, gapHighWarning: 70, nominalGap: 40 };
export const SEGMENT_WIDTHS = { U: 1200, R: 1400, L: 1400 };
export const RECORD_LABELS = { measured: 'ข้อมูลสนาม', planned: 'แผนคาดการณ์', sample: 'ข้อมูลตัวอย่าง', legacy: 'ยังไม่ระบุแหล่งข้อมูล' };
export const finite = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
export const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
export const ringNumber = ring => Number(String(ring?.ringNum ?? ring?.ringNumber ?? '').replace(/^R/i, ''));
export const nextRingNumber = (logs = []) => `R${String(Math.max(0, ...logs.map(ringNumber).filter(Number.isFinite)) + 1).padStart(4, '0')}`;
export const recordKind = ring => {
  if (RECORD_LABELS[ring?.recordType]) return ring.recordType;
  const tag = String(ring?.notes || '').match(/^\[TBM:(measured|planned|sample|legacy)\]/);
  if (tag) return tag[1];
  if (INITIAL_RING_LOGS.some(sample => sample.ringNum === ring?.ringNum && sample.timestamp === ring?.timestamp && sample.key === ring?.key && sample.notes === ring?.notes)) return 'sample';
  if (/^(Auto Planned|Planned with Before|Sec |Advance Planned)/.test(ring?.notes || '')) return 'planned';
  return 'legacy';
};
export const measuredLogs = logs => logs.filter(r => recordKind(r) === 'measured' && KEY_DATA[r.key] && finite(r.hLead) && finite(r.vLead));
export const latestMeasured = logs => measuredLogs(logs).sort((a, b) => ringNumber(a) - ringNumber(b)).at(-1) || null;

export function readStored(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; }
}

export function getLimits(gapSettings = {}) {
  return {
    ...DEFAULT_LIMITS,
    gapWarning: Number(gapSettings.warnThreshold ?? 15),
    gapCritical: Number(gapSettings.criticalThreshold ?? 5),
    gapHighWarning: Number(gapSettings.highWarnThreshold ?? 70),
  };
}

export function predictGaps(h, v, settings = {}) {
  const clip = value => round(Math.max(0, Math.min(120, value)), 1);
  return {
    gapT: clip(Number(settings.initialGapTop ?? 40) - .30 * Number(v)),
    gapB: clip(Number(settings.initialGapBottom ?? 40) + .30 * Number(v)),
    gapL: clip(Number(settings.initialGapLeft ?? 40) - .30 * Number(h)),
    gapR: clip(Number(settings.initialGapRight ?? 40) + .30 * Number(h)),
  };
}

export function predictIncrementalGaps({ beforeH = 0, beforeV = 0, afterH = 0, afterV = 0, baseGaps = null, settings = {} } = {}) {
  const hasBase = baseGaps && ['gapT', 'gapB', 'gapL', 'gapR'].every(key => finite(baseGaps[key]));
  if (!hasBase) return predictGaps(afterH, afterV, settings);
  const clip = value => round(Math.max(0, Math.min(120, value)), 1);
  const dH = Number(afterH) - Number(beforeH);
  const dV = Number(afterV) - Number(beforeV);
  return {
    gapT: clip(Number(baseGaps.gapT) - .30 * dV),
    gapB: clip(Number(baseGaps.gapB) + .30 * dV),
    gapL: clip(Number(baseGaps.gapL) - .30 * dH),
    gapR: clip(Number(baseGaps.gapR) + .30 * dH),
  };
}

export function diagnoseOvality({ gapT, gapB, gapL, gapR, nominal = 40, lowWarn = 15, highWarn = 70 } = {}) {
  if (![gapT, gapB, gapL, gapR].every(finite)) {
    return { shape: 'unknown', label: 'ยังไม่ทราบรูปทรง', level: 'unknown', summary: 'กรอกค่า Gap ครบ 4 ด้านเพื่อวิเคราะห์รูปทรงวงแหวน' };
  }
  const t = Number(gapT), b = Number(gapB), l = Number(gapL), r = Number(gapR);
  const sumV = round(t + b, 1);
  const sumH = round(l + r, 1);
  const minSideLR = Math.min(l, r);
  const maxSideLR = Math.max(l, r);
  const minSideTB = Math.min(t, b);
  const maxSideTB = Math.max(t, b);

  // Horizontal ovality ("ไข่นอน"): side gaps squeezed (and/or bottom squeezed) while top gap is wide
  if ((t > nominal + 12 && l < nominal - 8 && r < nominal - 8)
    || (t > maxSideLR + 15 && minSideLR <= lowWarn + 10 && b <= t - 10)
    || (sumH < 2 * nominal - 15 && sumV > sumH + 15)) {
    return {
      shape: 'horizontal_oval',
      label: 'ไข่นอน (แบนแนวตั้ง / ขยายข้าง)',
      level: 'warning',
      sumV, sumH,
      summary: `ด้านข้าง L/R (${l}/${r} mm) เบียดแคบลง ขณะที่ด้านบนเปิดกว้าง (${t} mm) · ผลรวม V=${sumV} vs H=${sumH} mm`,
    };
  }
  // Vertical ovality ("ไข่ตั้ง"): top/bottom squeezed while left/right are wide
  if ((t < nominal - 8 && b < nominal - 8 && (l > nominal + 8 || r > nominal + 8))
    || (minSideTB <= lowWarn + 10 && maxSideLR >= nominal + 15 && minSideLR > maxSideTB)
    || (sumV < 2 * nominal - 15 && sumH > sumV + 15)) {
    return {
      shape: 'vertical_oval',
      label: 'ไข่ตั้ง (ยืดแนวตั้ง / หุบข้าง)',
      level: 'warning',
      sumV, sumH,
      summary: `ด้านบน/ล่าง T/B (${t}/${b} mm) เบียดแคบลง ขณะที่ด้านข้าง L/R กว้าง (${l}/${r} mm) · ผลรวม V=${sumV} vs H=${sumH} mm`,
    };
  }
  // All-tight
  if (sumV < 2 * nominal - 20 && sumH < 2 * nominal - 20) {
    return {
      shape: 'all_tight',
      label: 'เบียดแคบรอบด้าน',
      level: 'critical',
      sumV, sumH,
      summary: `Gap รวมทุกด้านแคบกว่าปกติ (V=${sumV}, H=${sumH} mm เทียบมาตรฐาน ${2 * nominal} mm) เสี่ยงชนท้ายโล่`,
    };
  }
  // All-loose / high gap
  if ((sumV > 2 * nominal + 20 && sumH > 2 * nominal + 20) || Math.max(t, b, l, r) > highWarn) {
    return {
      shape: 'all_loose',
      label: 'ช่องว่างกว้างผิดปกติ',
      level: 'warning',
      sumV, sumH,
      summary: `มีด้านที่ Gap กว้างเกินเกณฑ์ (สูงสุด ${Math.max(t, b, l, r)} mm > ${highWarn} mm) เสี่ยง Tail Seal / Grout รั่ว`,
    };
  }
  // Eccentric shift (round ring shifted off-center)
  if (Math.abs(t - b) > 20 || Math.abs(l - r) > 20) {
    return {
      shape: 'eccentric',
      label: 'วงแหวนกลมแต่เยื้องศูนย์',
      level: 'normal',
      sumV, sumH,
      summary: `ผลรวมใกล้เคียงปกติ (V=${sumV}, H=${sumH} mm) แต่วางเยื้องด้าน (T/B ${t}/${b}, L/R ${l}/${r} mm)`,
    };
  }
  return {
    shape: 'round',
    label: 'กลมปกติ',
    level: 'normal',
    sumV, sumH,
    summary: `รูปทรงวงแหวนสมดุล (V=${sumV}, H=${sumH} mm · มาตรฐาน ${2 * nominal} mm)`,
  };
}

/** Independent checks: lead is not a survey/DTA deviation. Missing values stay unknown. */
export function assessRing(ring, limits = DEFAULT_LIMITS) {
  const h = ring.afterH ?? ring.afterHLead ?? ring.hLead;
  const v = ring.afterV ?? ring.afterVLead ?? ring.vLead;
  const leadKnown = finite(h) && finite(v);
  const gapValues = ['gapT', 'gapB', 'gapL', 'gapR'].map(key => ring[key]);
  const gapKnown = gapValues.every(finite);
  const deviationKnown = finite(ring.deviationMm);
  const leadMax = leadKnown ? Math.max(Math.abs(Number(h)), Math.abs(Number(v))) : null;
  const minGap = gapKnown ? Math.min(...gapValues.map(Number)) : null;
  const maxGap = gapKnown ? Math.max(...gapValues.map(Number)) : null;
  const highLimit = Number(limits.gapHighWarning ?? 70);
  const issues = [];
  if (!leadKnown) issues.push({ level: 'unknown', code: 'lead-missing', message: 'ยังไม่มีค่า H/V Lead ครบ' });
  if (leadKnown && leadMax > limits.lead) issues.push({ level: 'warning', code: 'lead', message: `Lead สูงสุด ${round(leadMax)} mm เกิน ±${limits.lead} mm` });
  if (gapKnown && gapValues.some(value => Number(value) < 0)) issues.push({ level: 'critical', code: 'gap-invalid', message: 'Gap ติดลบ: ตรวจค่าที่กรอก' });
  else {
    if (gapKnown && minGap <= limits.gapCritical) issues.push({ level: 'critical', code: 'gap', message: `Gap ต่ำสุด ${round(minGap, 1)} mm ≤ ${limits.gapCritical} mm` });
    else if (gapKnown && minGap <= limits.gapWarning) issues.push({ level: 'warning', code: 'gap', message: `Gap ต่ำสุด ${round(minGap, 1)} mm ≤ ${limits.gapWarning} mm` });
    if (gapKnown && highLimit > 0 && maxGap > highLimit) issues.push({ level: 'warning', code: 'gap-high', message: `Gap สูงสุด ${round(maxGap, 1)} mm > ${highLimit} mm (เสี่ยง Tail Seal / Grout รั่ว)` });
  }
  if (!gapKnown) issues.push({ level: 'unknown', code: 'gap-missing', message: 'ยังไม่มีค่า Gap ครบ 4 ด้าน' });
  if (deviationKnown && Math.abs(Number(ring.deviationMm)) > limits.deviation) issues.push({ level: 'critical', code: 'dta', message: `DTA H ${round(ring.deviationMm, 1)} mm อยู่นอก ±${limits.deviation} mm` });
  if (finite(ring.deviationVMm) && Math.abs(Number(ring.deviationVMm)) > limits.deviation) issues.push({ level: 'critical', code: 'dta', message: `DTA V ${round(ring.deviationVMm, 1)} mm อยู่นอก ±${limits.deviation} mm` });
  if (ring.articulationExceeded) issues.push({ level: 'critical', code: 'articulation', message: 'มุม Taper ต่อริงเกินเพดานที่ตั้งในแบบจำลอง' });
  if (!ring.ignoreSuitability) {
    if (ring.suitability === 'No') issues.push({ level: 'critical', code: 'suitability', message: 'คีย์ไม่ผ่าน Suitability Matrix' });
    else if (ring.suitability === 'Fair') issues.push({ level: 'warning', code: 'suitability', message: 'คีย์เข้ากันได้ระดับ Fair: ต้องตรวจทาน' });
  }
  const level = issues.some(i => i.level === 'critical') ? 'critical' : issues.some(i => i.level === 'warning') ? 'warning' : issues.some(i => i.level === 'unknown') ? 'unknown' : 'normal';
  return { level, issues, leadMax, minGap, maxGap, deviationKnown, leadKnown, gapKnown, label: { critical: 'ต้องตรวจทาน', warning: 'มีคำเตือน', unknown: 'ข้อมูลไม่ครบ', normal: 'อยู่ในเกณฑ์ที่ตรวจ' }[level] };
}

export function summarizeRings(rings = [], limits = DEFAULT_LIMITS) {
  const assessed = rings.map(ring => ({ ring, ...assessRing(ring, limits) }));
  const leadValues = assessed.map(r => r.leadMax).filter(v => v !== null);
  const gaps = assessed.map(r => r.minGap).filter(v => v !== null);
  const deviations = rings.flatMap(r => [r.deviationMm, r.deviationVMm]).filter(finite).map(Number);
  const critical = assessed.filter(r => r.level === 'critical');
  const warnings = assessed.filter(r => r.level === 'warning');
  const unknown = assessed.filter(r => r.level === 'unknown');
  const level = critical.length ? 'critical' : warnings.length ? 'warning' : !rings.length || unknown.length ? 'unknown' : 'normal';
  return { assessed, level, critical, warnings, unknown, total: rings.length,
    maxLead: leadValues.length ? Math.max(...leadValues) : null,
    minGap: gaps.length ? Math.min(...gaps) : null,
    maxDeviation: deviations.length ? Math.max(...deviations.map(Math.abs)) : null,
    leadCount: assessed.filter(r => r.issues.some(i => i.code === 'lead')).length,
    dtaCount: assessed.filter(r => r.issues.some(i => i.code === 'dta')).length,
    gapCount: assessed.filter(r => r.issues.some(i => i.code === 'gap')).length,
    problemCount: critical.length + warnings.length + unknown.length,
  };
}

export function validateRing(ring) {
  const errors = [];
  if (!/^R?\d+$/i.test(String(ring.ringNum || '')) || ringNumber(ring) < 1 || !Number.isSafeInteger(ringNumber(ring))) errors.push('หมายเลขริงต้องเป็น R ตามด้วยจำนวนเต็มมากกว่า 0');
  if (!KEY_DATA[ring.key || ring.selectedKey]) errors.push('เลือกคีย์จากรายการมาตรฐาน');
  for (const field of ['hLead', 'vLead', 'gapT', 'gapB', 'gapL', 'gapR']) {
    if (!finite(ring[field])) errors.push(`${field}: ต้องเป็นตัวเลข`);
    else if (field.startsWith('gap') && Number(ring[field]) < 0) errors.push(`${field}: ต้องไม่ติดลบ`);
  }
  if (ring.deviationMm !== '' && ring.deviationMm != null && !finite(ring.deviationMm)) errors.push('DTA deviation ต้องเป็นตัวเลข');
  return errors;
}

export function validatePlanningInput(input) {
  const errors = [];
  if (!KEY_DATA[input.startKey ?? input.beforeKey]) errors.push('คีย์เริ่มต้นไม่ถูกต้อง');
  for (const field of ['startHLead', 'startVLead', 'targetV']) if (field in input && !finite(input[field])) errors.push(`${field}: กรุณากรอกตัวเลข`);
  if ('ringCount' in input && (!finite(input.ringCount) || !Number.isInteger(Number(input.ringCount)) || Number(input.ringCount) < 1 || Number(input.ringCount) > 100)) errors.push('จำนวนริงต้องเป็นจำนวนเต็ม 1–100');
  if (input.alignmentType && input.alignmentType !== 'straight' && (!finite(input.radius) || Number(input.radius) <= 0)) errors.push('โค้งต้องมีรัศมีมากกว่า 0 m');
  if ('maxTolerance' in input && (!finite(input.maxTolerance) || Number(input.maxTolerance) <= 0)) errors.push('Lead limit ต้องมากกว่า 0 mm');
  return errors;
}

export function validateGapSettings(settings) {
  const errors = [];
  for (const key of ['initialGapTop', 'initialGapBottom', 'initialGapLeft', 'initialGapRight']) if (!finite(settings[key]) || Number(settings[key]) < 0 || Number(settings[key]) > 100) errors.push(`${key}: ต้องอยู่ในช่วง 0–100 mm ของแบบจำลอง`);
  if (!finite(settings.warnThreshold) || !finite(settings.criticalThreshold) || Number(settings.criticalThreshold) < 0 || Number(settings.warnThreshold) <= Number(settings.criticalThreshold)) errors.push('เกณฑ์เตือนต้องมากกว่าเกณฑ์วิกฤต และทั้งสองค่าต้องไม่ติดลบ');
  return errors;
}

const station = value => {
  if (!/^(\d+\+\d+(\.\d+)?|\d+(\.\d+)?)$/.test(String(value))) return NaN;
  const parts = String(value).split('+').map(Number);
  return parts.length === 2 ? parts[0] * 1000 + parts[1] : parts[0];
};

export function validateAlignment(sections = [], vertical = []) {
  const errors = [];
  if (!Array.isArray(sections) || !sections.length) return ['ต้องมีแนวราบอย่างน้อย 1 ช่วง'];
  const codes = new Set();
  let previousEnd = null, previousSign = null;
  sections.forEach((s, index) => {
    const name = `ช่วง ${s.code || index + 1}`;
    const code = typeof s.code === 'string' ? s.code.trim() : '';
    if (!code || codes.has(code)) errors.push(`${name}: รหัสต้องไม่ว่างและไม่ซ้ำ`);
    codes.add(code);
    const start = station(s.startSTA), end = station(s.endSTA);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) errors.push(`${name}: STA เริ่ม/สิ้นสุดไม่ถูกต้องหรือระยะเป็นศูนย์`);
    else {
      const sign = Math.sign(end - start);
      if (previousEnd !== null && Math.abs(start - previousEnd) > .002) errors.push(`${name}: STA ไม่ต่อกับช่วงก่อนหน้า (${round(start - previousEnd, 3)} m)`);
      if (previousSign !== null && previousSign !== sign) errors.push(`${name}: ทิศทาง STA กลับด้านจากช่วงก่อนหน้า`);
      previousSign = sign; previousEnd = end;
      if (Math.abs(end - start) > 15000) errors.push(`${name}: ระยะเกิน 15 km กรุณาแบ่งเป็นช่วงย่อย`);
    }
    if (!['tangent', 'full_curve', 'transition_in', 'transition_out'].includes(s.sectionType)) errors.push(`${name}: ประเภทแนวไม่ถูกต้อง`);
    if (!['straight', 'right', 'left'].includes(s.direction)) errors.push(`${name}: ทิศทางโค้งไม่ถูกต้อง`);
    if (s.sectionType !== 'tangent' && s.direction !== 'straight' && (!finite(s.radius) || Number(s.radius) <= 0)) errors.push(`${name}: รัศมีโค้งต้องมากกว่า 0`);
    const allowed = s.allowedTypes || ['U', 'R', 'L'];
    if (!allowed.length || allowed.some(t => !SEGMENT_WIDTHS[t])) errors.push(`${name}: ต้องอนุญาตชนิดเซ็กเมนต์ที่ถูกต้อง`);
    const ratio = s.ratio || {};
    const ratios = ['un', 'rt', 'lt'].map(k => ratio[k]);
    if (ratios.some(v => !finite(v) || Number(v) < 0) || ratios.reduce((sum, v) => sum + Number(v), 0) <= 0) errors.push(`${name}: Ratio ต้องไม่ติดลบและรวมมากกว่า 0`);
    [['U', 'un'], ['R', 'rt'], ['L', 'lt']].forEach(([type, key]) => { if (!allowed.includes(type) && Number(ratio[key]) > 0) errors.push(`${name}: Ratio ${type} มากกว่า 0 แต่ไม่อนุญาตให้ใช้`); });
  });
  if (!Array.isArray(vertical)) return [...errors, 'ข้อมูลแนวดิ่งต้องเป็นรายการ'];
  let previousVEnd = null;
  vertical.forEach((v, index) => {
    const name = `แนวดิ่ง ${v.code || index + 1}`;
    const start = station(v.startSTA), end = station(v.endSTA);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) errors.push(`${name}: STA ไม่ถูกต้องหรือระยะเป็นศูนย์`);
    if (previousVEnd !== null && Math.abs(start - previousVEnd) > .002) errors.push(`${name}: STA ไม่ต่อกับช่วงก่อนหน้า`);
    previousVEnd = end;
    for (const field of ['startElev', 'endElev', 'gradePct']) if (!finite(v[field])) errors.push(`${name}: ${field} ต้องเป็นตัวเลข`);
    if (v.curveType !== 'constant_grade' && (!finite(v.radiusV) || Number(v.radiusV) <= 0)) errors.push(`${name}: รัศมีแนวดิ่งต้องมากกว่า 0`);
  });
  return errors;
}

export function validateConditioning(input) {
  const errors = [];
  for (const key of ['tbmDia', 'segWidth', 'jackSpeed', 'atmPressure']) if (!finite(input[key]) || Number(input[key]) <= 0) errors.push(`${key}: ต้องมากกว่า 0`);
  for (const key of ['foamDosage', 'fir', 'earthPressure', 'polymerDosage', 'polymerInjection', 'distance']) if (key in input && (!finite(input[key]) || Number(input[key]) < 0)) errors.push(`${key}: ต้องไม่ติดลบ`);
  if (!finite(input.fer) || Number(input.fer) < 1) errors.push('FER ต้องไม่น้อยกว่า 1');
  for (const key of ['foamDosage', 'polymerDosage']) if (Number(input[key]) > 100) errors.push(`${key}: ความเข้มข้นต้องไม่เกิน 100%`);
  return errors;
}

export function buildCSV(headers, rows) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[=+@\t\r]/.test(text) || /^-\D/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

export function exportCSV(filename, headers, rows) {
  const blob = new Blob([buildCSV(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

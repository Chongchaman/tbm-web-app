import { finite, round } from './decisionSupport.js';

export const SOIL_PROFILES = {
  soft_clay: { label:'Soft clay', fir:[25,35,45], fer:[6,8,10], concentration:[1,1.5,2] },
  stiff_clay: { label:'Stiff clay', fir:[30,40,50], fer:[6,8,10], concentration:[1,1.5,2] },
  silty_clay: { label:'Silty clay', fir:[35,45,55], fer:[7,9,11], concentration:[1,1.5,2.5] },
  silty_sand: { label:'Silty sand', fir:[40,50,60], fer:[8,10,13], concentration:[1.5,2,3] },
  sand: { label:'Sand', fir:[48,58,70], fer:[8,11,15], concentration:[1.5,2.5,3.5] },
  coarse_weathered: { label:'Coarse sand / Weathered soil', fir:[55,65,80], fer:[10,15,18], concentration:[2.5,3,4] },
  mixed_face: { label:'Mixed face', fir:[35,50,65], fer:[8,10,14], concentration:[1.5,2,3] },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const shiftRange = (range, delta, min, max) => range.map(value => round(clamp(value + delta, min, max), 1));
const known = value => value !== '' && value !== null && value !== undefined && value !== 'unknown';
const percent = value => finite(value) && Number(value) >= 0 && Number(value) <= 100;

/**
 * Screening-level EPB conditioning adviser. Values are trial windows, not final
 * operating setpoints; laboratory workability/permeability tests and TBM response
 * must confirm them for the actual soil and product.
 */
export function recommendSoilConditioning(input = {}) {
  const profile = SOIL_PROFILES[input.soilType] || SOIL_PROFILES.mixed_face;
  let firDelta = 0;
  let ferDelta = 0;
  const reasons = [`เริ่มจากช่วงอ้างอิงของ ${profile.label}`];
  const cautions = [];
  const missing = [];
  let polymerSuggested = false;

  const finesKnown = percent(input.finesContent);
  const waterKnown = percent(input.waterContent);
  const piKnown = percent(input.plasticityIndex);
  const fines = finesKnown ? Number(input.finesContent) : null;
  const water = waterKnown ? Number(input.waterContent) : null;
  const pi = piKnown ? Number(input.plasticityIndex) : null;

  if (!finesKnown) missing.push('เม็ดละเอียด <0.075 mm');
  else if (fines < 15) { firDelta += 8; ferDelta += 2; reasons.push('เม็ดละเอียดต่ำ จึงเพิ่มปริมาณและความแห้งของโฟมเพื่อเติมช่องว่าง'); }
  else if (fines < 35) { firDelta += 3; ferDelta += 1; reasons.push('เม็ดละเอียดค่อนข้างต่ำ จึงขยับ FIR ขึ้นเล็กน้อย'); }
  else if (fines > 60) { firDelta -= 5; ferDelta -= 1; reasons.push('เม็ดละเอียดสูง จึงลดปริมาณโฟมและใช้โฟมเปียกขึ้น'); }

  if (!waterKnown) missing.push('ความชื้นธรรมชาติ');
  else if (water < 10) { firDelta += 5; ferDelta -= 1; reasons.push('ดินค่อนข้างแห้ง จึงเพิ่ม FIR และลด FER เพื่อเพิ่มของเหลวในส่วนผสม'); }
  else if (water > 30) { firDelta -= 6; ferDelta += 1; reasons.push('ความชื้นสูง จึงลด FIR และเพิ่ม FER เพื่อลดของเหลวเพิ่ม'); cautions.push('เฝ้าระวัง muck เหลวและการไหลพุ่งที่ screw conveyor'); }
  else if (water > 22) { firDelta -= 3; reasons.push('ความชื้นค่อนข้างสูง จึงลด FIR ลงเล็กน้อย'); }

  if (!piKnown) missing.push('Plasticity Index (PI)');
  else if (pi >= 25) { firDelta += 3; ferDelta -= 1; polymerSuggested = true; reasons.push('PI สูง มีโอกาสเหนียวติด จึงเพิ่มโฟมและใช้โฟมเปียกขึ้น'); cautions.push('ควรทดสอบสารลดการเกาะติดหรือ Polymer กับดินจริง'); }
  else if (pi <= 5 && finesKnown && fines < 20) { polymerSuggested = true; cautions.push('ดินยึดเกาะต่ำ ควรทดสอบ Polymer/Bentonite เพื่อช่วยลด permeability'); }

  if (!known(input.permeability)) missing.push('การซึมน้ำ');
  else if (input.permeability === 'high') { firDelta += 5; ferDelta += 1; polymerSuggested = true; reasons.push('การซึมน้ำสูง จึงเพิ่ม FIR และความเสถียรของโฟม'); cautions.push('ยืนยัน permeability และ foam half-life ภายใต้ความดันใช้งาน'); }

  if (!known(input.groundwater)) missing.push('น้ำใต้ดิน/น้ำไหลเข้า');
  else if (input.groundwater === 'high') { firDelta += 4; ferDelta += 1; polymerSuggested = true; reasons.push('น้ำไหลเข้าสูง จึงเพิ่ม FIR และใช้โฟมที่เสถียรขึ้น'); }

  if (input.muckCondition === 'dry') { firDelta += 5; ferDelta -= 1; reasons.push('muck ร่วน/แห้ง จึงเพิ่มโฟมและของเหลว'); }
  if (input.muckCondition === 'wet') { firDelta -= 6; ferDelta += 1; reasons.push('muck เหลว จึงลด FIR และลดน้ำที่เติม'); }
  if (input.muckCondition === 'sticky') { firDelta += 3; ferDelta -= 1; polymerSuggested = true; reasons.push('muck เหนียวติด จึงขยับไปทางโฟมเปียกและแนะนำทดสอบสารลดการเกาะติด'); }
  if (input.torqueTrend === 'high') { firDelta += 4; reasons.push('Torque สูงกว่าปกติ จึงเพิ่ม FIR สำหรับรอบทดลองถัดไป'); }

  const fir = shiftRange(profile.fir, firDelta, 10, 85);
  const fer = shiftRange(profile.fer, ferDelta, 5, 20);
  const concentration = [...profile.concentration];
  const liquidInjectionRatio = round(fir[1] / fer[1], 1);

  const completenessWeights = {
    soilType: 20, finesContent: 25, waterContent: 20, plasticityIndex: 15,
    permeability: 10, groundwater: 10,
  };
  const completeness = Object.entries(completenessWeights).reduce((sum,[key,weight]) => sum + (key === 'soilType' ? Boolean(SOIL_PROFILES[input[key]]) : key === 'finesContent' || key === 'waterContent' || key === 'plasticityIndex' ? percent(input[key]) : known(input[key])) * weight, 0);
  const qualityFactor = { lab:1, field:.82, estimate:.62 }[input.dataQuality] || .55;
  const confidenceScore = Math.round(completeness * qualityFactor);
  const confidence = confidenceScore >= 80 ? 'high' : confidenceScore >= 55 ? 'medium' : 'low';

  if (missing.length) cautions.push(`ข้อมูลที่ยังขาด: ${missing.join(', ')}`);
  cautions.push('ยืนยันช่วงนี้ด้วย slump/flow table, permeability และผล Torque/Pressure/การคายดินก่อนใช้เป็นค่าประจำ');

  return {
    soilLabel: profile.label,
    fir: { min:fir[0], target:fir[1], max:fir[2] },
    fer: { min:fer[0], target:fer[1], max:fer[2] },
    concentration: { min:concentration[0], target:concentration[1], max:concentration[2] },
    liquidInjectionRatio,
    confidence,
    confidenceScore,
    completeness,
    missing,
    reasons,
    cautions,
    polymerSuggested,
  };
}


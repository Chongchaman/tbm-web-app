import { finite } from './decisionSupport.js';

export const DEFAULT_RECOVERY = {
  startDeviationH: 0, startDeviationV: 0, startHeadingErrorDeg: 0, startPitchErrorDeg: 0,
  recoveryDistanceM: 20, endpointToleranceMm: 75, endpointHeadingToleranceDeg: 0.1,
  maxTaperTurnDeg: 0.55,
  responseDiameterMm: 6300,
  initialStateConfirmed: false,
};
export const radians = degrees => degrees * Math.PI / 180;
export const degrees = angle => angle * 180 / Math.PI;
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export const rounded = (value, digits = 3) => Number(value.toFixed(digits));

export function validateRecovery(config) {
  const errors = [];
  const labels={startDeviationH:'ระยะเยื้อง H',startDeviationV:'ระยะเยื้อง V',startHeadingErrorDeg:'มุมคลาดแนวราบ',startPitchErrorDeg:'มุมคลาดแนวดิ่ง',
    recoveryDistanceM:'ระยะเป้าหมายกลับเข้าแนว',endpointToleranceMm:'เกณฑ์ตำแหน่งปลายทาง',endpointHeadingToleranceDeg:'เกณฑ์มุมปลายทาง',maxTaperTurnDeg:'เพดานมุม Taper ต่อริง',responseDiameterMm:'เส้นผ่านศูนย์กลางแบบจำลอง Taper'};
  for (const name of ['startDeviationH','startDeviationV','startHeadingErrorDeg','startPitchErrorDeg']) {
    if (!finite(config[name])) errors.push(`${labels[name]}: ต้องกรอกตัวเลขจากค่าตรวจวัด หรือใช้ค่าตัวอย่าง`);
  }
  for (const name of ['startHeadingErrorDeg','startPitchErrorDeg']) {
    if (Math.abs(Number(config[name])) > 10) errors.push(`${labels[name]}: แบบจำลองรองรับมุมคลาดไม่เกิน ±10°`);
  }
  for (const name of ['recoveryDistanceM','endpointToleranceMm','endpointHeadingToleranceDeg','maxTaperTurnDeg','responseDiameterMm']) {
    if (!finite(config[name]) || Number(config[name]) <= 0) errors.push(`${labels[name]}: ต้องมากกว่า 0`);
  }
  return errors;
}

// Quintic reference offset: measured position and tangent at the start,
// zero offset, tangent and curvature at the requested recovery station.
// A target curve is not a guarantee that discrete keys or a real shield can follow it.
export function recoveryTarget(distanceM, lengthM, offsetMm, headingRad) {
  if (distanceM >= lengthM) return { offsetMm: 0, headingRad: 0 };
  const t = Math.max(0, distanceM / lengthM);
  const t2=t*t, t3=t2*t, t4=t3*t, t5=t4*t;
  const slope = Math.tan(headingRad) * 1000;
  const offset = offsetMm*(1-10*t3+15*t4-6*t5) + slope*lengthM*(t-6*t3+8*t4-3*t5);
  const derivative = offsetMm*(-30*t2+60*t3-30*t4)/lengthM + slope*(1-18*t2+32*t3-15*t4);
  return { offsetMm: offset, headingRad: Math.atan(derivative/1000) };
}

const station = value => {
  if (typeof value === 'number') return value;
  const parts=String(value).split('+').map(Number);
  return parts.length===2 ? parts[0]*1000+parts[1] : parts[0];
};

export function createRoute(sections, vertical, requestedStartSTA) {
  let end=0;
  const spans=sections.map(section=>{
    const start=end, length=Math.abs(station(section.endSTA)-station(section.startSTA));
    end+=length;
    return {section,start,end,length};
  });
  const direction=Math.sign(station(sections.at(-1).endSTA)-station(sections[0].startSTA));
  const originSTA=station(sections[0].startSTA);
  const selectedSTA=requestedStartSTA==null || requestedStartSTA==='' ? originSTA : station(requestedStartSTA);
  const startOffset=(selectedSTA-originSTA)*direction;
  if (!Number.isFinite(startOffset) || startOffset<0 || startOffset>=end) throw new Error('STA ปัจจุบันต้องอยู่ภายในแนวและก่อนจุดปลายทาง');
  const totalDistance=end-startOffset;
  const at=distance=>spans.find(span=>distance+startOffset<span.end-1e-8) || spans.at(-1);
  const staAt=distance=>originSTA+direction*(distance+startOffset);
  const curvature=distance=>{
    const span=at(distance), sec=span.section;
    if (sec.sectionType==='tangent' || sec.direction==='straight') return 0;
    const progress=Math.max(0,Math.min(1,(distance+startOffset-span.start)/span.length));
    const multiplier=sec.sectionType==='transition_in'?progress:sec.sectionType==='transition_out'?1-progress:1;
    return (sec.direction==='right'?1:-1)*multiplier/Number(sec.radius);
  };
  // Vertical reference honors the supplied endpoint elevations. Curves use a
  // parabolic approximation of radiusV; this is not a surveyed 3D alignment import.
  const verticalAt=distance=>{
    const sta=staAt(Math.min(totalDistance,Math.max(0,distance)));
    const element=vertical.find(v=>sta>=Math.min(station(v.startSTA),station(v.endSTA))-1e-7 && sta<=Math.max(station(v.startSTA),station(v.endSTA))+1e-7);
    if (!element) return null;
    const start=station(element.startSTA), finish=station(element.endSTA), length=Math.abs(finish-start);
    const t=Math.max(0,Math.min(1,(sta-start)/(finish-start)));
    const sign=element.curveType==='sag_curve'?1:element.curveType==='crest_curve'?-1:0;
    const curve=sign ? sign*length*length/(2*Number(element.radiusV)) : 0;
    const delta=Number(element.endElev)-Number(element.startElev);
    const elevation=Number(element.startElev)+delta*t+curve*t*(t-1);
    const slope=(delta+curve*(2*t-1))/length * direction/Math.sign(finish-start);
    return { elevation, pitch:Math.atan(slope) };
  };
  return {at,staAt,curvature,verticalAt,totalDistance,startOffset,spans};
}

export function initialRecoveryState(route, config) {
  const vertical=route.verticalAt(0);
  return {distance:0,dtaX:0,dtaY:0,dtaTheta:0,tbmX:Number(config.startDeviationH)/1000,tbmY:0,
    tbmTheta:radians(Number(config.startHeadingErrorDeg)),dtaZ:vertical?.elevation??0,
    tbmZ:(vertical?.elevation??0)+Number(config.startDeviationV)/1000,
    dtaPitch:vertical?.pitch??0,tbmPitch:(vertical?.pitch??0)+radians(Number(config.startPitchErrorDeg)),
    deviationH:Number(config.startDeviationH),deviationV:Number(config.startDeviationV),longitudinalDeviation:0,
    headingError:radians(Number(config.startHeadingErrorDeg)),pitchError:radians(Number(config.startPitchErrorDeg))};
}

// Propagate a key's simplified taper response over physical ring length. The
// last ring is sampled at the exact design endpoint, not at its beyond-end edge.
export function propagateRecovery(state, route, lengthM, turnH, turnV) {
  const next={...state};
  const travel=Math.min(lengthM,route.totalDistance-state.distance);
  const count=Math.max(1,Math.ceil(travel/0.2)), step=travel/count;
  for(let i=0;i<count;i++) {
    const midDistance=next.distance+step/2;
    const designTurn=route.curvature(midDistance)*step;
    const yawTurn=turnH*step/lengthM, pitchTurn=turnV*step/lengthM;
    next.dtaX+=step*Math.sin(next.dtaTheta+designTurn/2);
    next.dtaY+=step*Math.cos(next.dtaTheta+designTurn/2);
    next.tbmX+=step*Math.sin(next.tbmTheta+yawTurn/2);
    next.tbmY+=step*Math.cos(next.tbmTheta+yawTurn/2);
    next.tbmZ+=step*Math.tan(next.tbmPitch+pitchTurn/2);
    next.dtaTheta+=designTurn;next.tbmTheta+=yawTurn;next.tbmPitch+=pitchTurn;next.distance+=step;
  }
  next.distance=Math.min(route.totalDistance,state.distance+travel);
  const vertical=route.verticalAt(next.distance);
  next.dtaZ=vertical?.elevation??state.dtaZ;
  next.dtaPitch=vertical?.pitch??state.dtaPitch;
  next.deviationH=((next.tbmX-next.dtaX)*Math.cos(next.dtaTheta)-(next.tbmY-next.dtaY)*Math.sin(next.dtaTheta))*1000;
  next.deviationV=(next.tbmZ-next.dtaZ)*1000;
  next.longitudinalDeviation=((next.tbmX-next.dtaX)*Math.sin(next.dtaTheta)+(next.tbmY-next.dtaY)*Math.cos(next.dtaTheta))*1000;
  next.headingError=wrapAngle(next.tbmTheta-next.dtaTheta);
  next.pitchError=wrapAngle(next.tbmPitch-next.dtaPitch);
  return next;
}

export function endpointAssessment(state, config, verticalKnown=true) {
  const positionPass=Math.abs(state.deviationH)<=Number(config.endpointToleranceMm) && Math.abs(state.deviationV)<=Number(config.endpointToleranceMm) && Math.abs(state.longitudinalDeviation??0)<=Number(config.endpointToleranceMm);
  const headingPass=Math.abs(degrees(state.headingError))<=Number(config.endpointHeadingToleranceDeg)+1e-9 && Math.abs(degrees(state.pitchError))<=Number(config.endpointHeadingToleranceDeg)+1e-9;
  const known=config.initialStateConfirmed===true && verticalKnown;
  return {deviationH:rounded(state.deviationH,1),deviationV:rounded(state.deviationV,1),
    longitudinalDeviationMm:rounded(state.longitudinalDeviation??0,1),
    headingErrorDeg:rounded(degrees(state.headingError),6),pitchErrorDeg:rounded(degrees(state.pitchError),6),
    positionPass,headingPass,known,passed:known&&positionPass&&headingPass,
    level:!positionPass||!headingPass?'critical':known?'normal':'unknown',
    toleranceMm:Number(config.endpointToleranceMm),headingToleranceDeg:Number(config.endpointHeadingToleranceDeg)};
}

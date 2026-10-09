import { KEY_DATA } from '../data/tbmConstants.js';
import { finite, ringNumber, round } from './decisionSupport.js';

const RESPONSE_DIAMETER_MM = 6300;

function ringLength(ring, type) {
  if (finite(ring.sizeM)) return Number(ring.sizeM);
  if (finite(ring.simulatedLengthM)) return Number(ring.simulatedLengthM);
  if (finite(ring.size)) return Number(ring.size) / 1000;
  return type === 'U' ? 1.2 : 1.4;
}

function ringTurn(ring, length, fallbackDirection, fallbackRadius) {
  if (finite(ring.leadReq)) return Number(ring.leadReq) / RESPONSE_DIAMETER_MM;
  const direction = ring.planningAlignmentType || ring.alignmentType || ring.sectionDirection || fallbackDirection;
  const radius = Number(ring.planningRadius || ring.radius || fallbackRadius);
  if (!Number.isFinite(radius) || radius <= 0 || direction === 'straight') return 0;
  return length / radius * (direction === 'left' ? -1 : 1);
}

function gapMinimum(ring) {
  const values = ['gapT', 'gapB', 'gapL', 'gapR'].map(key => Number(ring[key])).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

export function buildSequenceVisualPlan({ historyPlans = [], currentRings = [], alignmentType = 'straight', radius = 500, startRingNum, maxHistory = 80 } = {}) {
  const firstCurrent = ringNumber({ ringNum: startRingNum || currentRings[0]?.ringNum });
  const uniqueHistory = new Map();
  historyPlans.forEach(ring => {
    const number = ringNumber(ring);
    const key = ring.selectedKey || ring.key;
    if (Number.isFinite(number) && number > 0 && (!Number.isFinite(firstCurrent) || number < firstCurrent) && KEY_DATA[key]) uniqueHistory.set(number, ring);
  });
  const allHistory = [...uniqueHistory.entries()].sort((a, b) => a[0] - b[0]);
  const history = allHistory.slice(-Math.max(0, Number(maxHistory) || 0)).map(([, ring]) => ({ ...ring, planSource: 'history' }));
  const current = currentRings.filter(ring => KEY_DATA[ring.selectedKey || ring.key]).map(ring => ({
    ...ring,
    planSource: 'current',
    planningAlignmentType: alignmentType,
    planningRadius: Number(radius),
  }));
  let x = 0, y = 0, theta = 0, distance = 0;
  let unknownHistoryCount = 0;
  const plannedRings = [...history, ...current].map((sourceRing, index) => {
    const selectedKey = sourceRing.selectedKey || sourceRing.key;
    const type = sourceRing.type || KEY_DATA[selectedKey].type;
    const sizeM = ringLength(sourceRing, type);
    const fallbackDirection = sourceRing.planSource === 'current' ? alignmentType : 'straight';
    const fallbackRadius = sourceRing.planSource === 'current' ? radius : 0;
    if (sourceRing.planSource === 'history' && !finite(sourceRing.leadReq) && !sourceRing.planningAlignmentType && !sourceRing.alignmentType && !sourceRing.sectionDirection) unknownHistoryCount += 1;
    const turn = ringTurn(sourceRing, sizeM, fallbackDirection, fallbackRadius);
    const startX = x, startY = y;
    x += sizeM * Math.sin(theta + turn / 2);
    y += sizeM * Math.cos(theta + turn / 2);
    theta += turn;
    distance += sizeM;
    return {
      ...sourceRing,
      step: index + 1,
      key: selectedKey,
      selectedKey,
      type,
      sizeM: round(sizeM, 3),
      startX: round(startX, 6), startY: round(startY, 6), endX: round(x, 6), endY: round(y, 6),
      tbmX: round(x, 6), tbmY: round(y, 6), theta: round(theta, 8),
      dtaStartX: round(startX, 6), dtaStartY: round(startY, 6), dtaEndX: round(x, 6), dtaEndY: round(y, 6),
      dtaX: round(x, 6), dtaY: round(y, 6), dtaTheta: round(theta, 8),
      targetX: round(x, 6), targetY: round(y, 6), deviationMm: 0, deviationVMm: 0,
      minGap: sourceRing.minGap ?? sourceRing.assessment?.minGap ?? gapMinimum(sourceRing),
      afterH: sourceRing.afterH ?? sourceRing.afterHLead ?? sourceRing.hLead ?? 0,
      afterV: sourceRing.afterV ?? sourceRing.afterVLead ?? sourceRing.vLead ?? 0,
      sta: sourceRing.sta || (sourceRing.planSource === 'history' ? 'แผนที่บันทึก' : 'แผนใหม่'),
      turnDeg: round(turn * 180 / Math.PI, 4),
    };
  });
  const counts = {
    un: plannedRings.filter(ring => ring.type === 'U').length,
    rt: plannedRings.filter(ring => ring.type === 'R').length,
    lt: plannedRings.filter(ring => ring.type === 'L').length,
  };
  return {
    plannedRings,
    totalRings: plannedRings.length,
    totalDistanceM: round(distance, 2),
    totalTurnDeg: round(theta * 180 / Math.PI, 3),
    historyCount: history.length,
    currentCount: current.length,
    boundaryStep: history.length + (current.length ? 1 : 0),
    unknownHistoryCount,
    omittedHistoryCount: Math.max(0, allHistory.length - history.length),
    counts,
  };
}

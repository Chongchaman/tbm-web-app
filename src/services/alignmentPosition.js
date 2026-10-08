import { createRoute } from './alignmentRecovery.js';
import { finite, validateAlignment } from './decisionSupport.js';
import { stationMeters } from './soilProfile.js';

// Local chainage coordinates. No survey easting/northing is implied by this shape.
export function buildAlignmentPosition({ sections, vertical, currentSTA, recovery = {} }) {
  const errors = validateAlignment(sections, vertical);
  if (errors.length) return { errors };
  const startSTA = stationMeters(sections[0].startSTA);
  const endSTA = stationMeters(sections.at(-1).endSTA);
  const requestedSTA = stationMeters(currentSTA);
  if (requestedSTA === null) return { errors:['กรอก STA หัวเจาะปัจจุบันให้ถูกต้อง'] };
  const direction = Math.sign(endSTA - startSTA);
  const currentDistance = (requestedSTA - startSTA) * direction;
  if (currentDistance < -0.001 || currentDistance > Math.abs(endSTA - startSTA) + 0.001)
    return { errors:['STA หัวเจาะปัจจุบันอยู่นอกช่วง Alignment ของเครื่องนี้'] };

  const route = createRoute(sections, vertical, sections[0].startSTA);
  const total = route.totalDistance;
  const count = Math.min(360, Math.max(40, Math.ceil(total / 2)));
  const distances = [...new Set([...Array.from({ length:count + 1 }, (_, index) => total * index / count),
    Math.min(total, Math.max(0, currentDistance))])].sort((a,b) => a - b);
  let x = 0, y = 0, heading = 0, previousDistance = 0;
  const points = distances.map(distance => {
    const step = distance - previousDistance;
    if (step > 0) {
      const turn = route.curvature(previousDistance + step / 2) * step;
      x += step * Math.sin(heading + turn / 2);
      y += step * Math.cos(heading + turn / 2);
      heading += turn;
    }
    previousDistance = distance;
    return { distance, sta:route.staAt(distance), x, y, heading,
      elevation:route.verticalAt(distance)?.elevation ?? null,
      section:route.at(Math.min(distance, Math.max(0,total - 0.000001))).section.code };
  });
  const current = points.find(point => Math.abs(point.distance - currentDistance) < 0.000001);
  const hValid = finite(recovery.startDeviationH), vValid = finite(recovery.startDeviationV);
  const hMm = hValid ? Number(recovery.startDeviationH) : 0;
  const vMm = vValid ? Number(recovery.startDeviationV) : 0;
  const headingDeg = finite(recovery.startHeadingErrorDeg) ? Number(recovery.startHeadingErrorDeg) : 0;
  const pitchDeg = finite(recovery.startPitchErrorDeg) ? Number(recovery.startPitchErrorDeg) : 0;
  const confirmed = recovery.initialStateConfirmed === true && hValid && vValid &&
    finite(recovery.startHeadingErrorDeg) && finite(recovery.startPitchErrorDeg);
  const tbm = { x:current.x + hMm / 1000 * Math.cos(current.heading),
    y:current.y - hMm / 1000 * Math.sin(current.heading),
    elevation:current.elevation === null ? null : current.elevation + vMm / 1000,
    heading:current.heading + headingDeg * Math.PI / 180 };
  return { errors:[], points, current, tbm, totalDistance:total, currentDistance,
    startSTA, endSTA, hMm, vMm, headingDeg, pitchDeg, confirmed,
    verticalComplete:points.every(point => point.elevation !== null) };
}

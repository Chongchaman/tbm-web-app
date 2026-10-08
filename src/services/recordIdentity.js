import { recordKind, ringNumber } from './decisionSupport.js';

export function recordIdentity(ring) {
  return recordKind(ring) === 'planned'
    ? `planned:${ring.track || 'unassigned'}:${ringNumber(ring)}`
    : `${recordKind(ring)}:${ringNumber(ring)}`;
}

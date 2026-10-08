import { recordKind, ringNumber } from './decisionSupport.js';

export function recordIdentity(ring) {
  return `${recordKind(ring)}:${ring.track || 'EB'}:${ringNumber(ring)}`;
}

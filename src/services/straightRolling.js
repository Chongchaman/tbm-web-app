import { KEY_DATA, NEXT_RING_TABLE } from '../data/tbmConstants.js';

// Nine neutral LT/RT pairs. Each pair cancels its H/V taper lead, while the
// order moves the key position around the ring instead of repeating one pair.
export const STRAIGHT_ANTI_ROLL_CYCLE = Object.freeze([
  'L1', 'R3',
  'L14', 'R16',
  'L2', 'R4',
  'L15', 'R1',
  'L12', 'R14',
  'L3', 'R5',
  'L16', 'R2',
  'L13', 'R15',
  'L4', 'R6',
]);

export const STRAIGHT_ANTI_ROLL_PAIR_COUNT = STRAIGHT_ANTI_ROLL_CYCLE.length / 2;

export function straightAntiRollEnabled(alignmentType, allowedTypes = []) {
  return alignmentType === 'straight' && allowedTypes.includes('L') && allowedTypes.includes('R');
}

export function nextStraightAntiRollKey(previousKey) {
  const index = STRAIGHT_ANTI_ROLL_CYCLE.indexOf(previousKey);
  return index < 0 ? null : STRAIGHT_ANTI_ROLL_CYCLE[(index + 1) % STRAIGHT_ANTI_ROLL_CYCLE.length];
}

export function straightAntiRollMeta(previousKey, candidateKey, recentKeys = []) {
  const expectedKey = nextStraightAntiRollKey(previousKey);
  const cycleIndex = STRAIGHT_ANTI_ROLL_CYCLE.indexOf(candidateKey);
  const candidateType = KEY_DATA[candidateKey]?.type;
  const previousType = KEY_DATA[previousKey]?.type;
  const alternatesType = !['L', 'R'].includes(previousType) ||
    (previousType === 'L' && candidateType === 'R') || (previousType === 'R' && candidateType === 'L');
  const followsCycle = expectedKey === candidateKey;
  const recent = recentKeys.slice(-18);
  const lastUseDistance = [...recent].reverse().findIndex(key => key === candidateKey);
  const repeatsPair = recent.length >= 2 && recent.at(-2) === candidateKey && recent.at(-1) === previousKey;

  // This is a preference, not a safety override. Hard Gap, suitability and
  // alignment constraints in the planner still carry much larger costs.
  const alternationPenalty = alternatesType ? 0 : 20_000;
  const cyclePenalty = expectedKey && !followsCycle ? 2_500 : 0;
  const recentKeyPenalty = lastUseDistance >= 0 && lastUseDistance < 8 ? (8 - lastUseDistance) * 450 : 0;
  const repeatedPairPenalty = repeatsPair ? 20_000 : 0;
  const penalty = alternationPenalty + cyclePenalty + recentKeyPenalty + repeatedPairPenalty;

  return {
    expectedKey,
    followsCycle,
    alternatesType,
    repeatsPair,
    penalty, alternationPenalty, cyclePenalty, recentKeyPenalty, repeatedPairPenalty,
    cycleStep: cycleIndex < 0 ? null : Math.floor(cycleIndex / 2) + 1,
    pairCount: STRAIGHT_ANTI_ROLL_PAIR_COUNT,
  };
}

export function preferredStraightKeys(previousKey, availableKeys) {
  const available = availableKeys.filter(key => STRAIGHT_ANTI_ROLL_CYCLE.includes(key));
  const expected = nextStraightAntiRollKey(previousKey);
  if (expected && available.includes(expected)) return [expected];
  const previousType = KEY_DATA[previousKey]?.type;
  const opposite = previousType === 'L' ? 'R' : previousType === 'R' ? 'L' : null;
  const alternating = opposite ? available.filter(key => KEY_DATA[key].type === opposite) : available;
  return alternating.length ? alternating : available;
}

export function validateStraightAntiRollCycle() {
  return STRAIGHT_ANTI_ROLL_CYCLE.every((key, index, cycle) => {
    const next = cycle[(index + 1) % cycle.length];
    if (!NEXT_RING_TABLE[key]?.includes(next)) return false;
    if (index % 2 !== 0) return true;
    const current = KEY_DATA[key], paired = KEY_DATA[next];
    return current.type === 'L' && paired.type === 'R' &&
      Math.abs(current.hLead + paired.hLead) < 0.01 && Math.abs(current.vLead + paired.vLead) < 0.01;
  });
}

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
export const DEFAULT_MAX_PAIR_LOOPS = 3;
export const MAX_PAIR_LOOPS_LIMIT = 10;

const oppositeType = type => type === 'L' ? 'R' : type === 'R' ? 'L' : null;

function straightHistory(previousKey, recentKeys = []) {
  const history = recentKeys.length && recentKeys.at(-1) !== previousKey ? [...recentKeys, previousKey].slice(-24) : recentKeys.slice(-24);
  let start = history.length;
  while (start > 0 && ['L', 'R'].includes(KEY_DATA[history[start - 1]]?.type)) start--;
  const directional = history.slice(start);
  let blockStart = 0;
  for (let index = 1; index < directional.length; index++) {
    if (KEY_DATA[directional[index]]?.type === KEY_DATA[directional[index - 1]]?.type) blockStart = index;
  }
  return { history, block: directional.slice(blockStart) };
}

export function straightLoopPolicy(previousKey, recentKeys = [], maxPairLoops = DEFAULT_MAX_PAIR_LOOPS) {
  const limit = Math.min(MAX_PAIR_LOOPS_LIMIT, Math.max(1, Number(maxPairLoops) || DEFAULT_MAX_PAIR_LOOPS));
  const { history, block } = straightHistory(previousKey, recentKeys);
  if (!block.length) return { phase: 'start', limit, history, block, requiredType: null, requiredKey: null, pairKeys: [] };
  if (block.length === 1) return { phase: 'establish', limit, history, block, requiredType: oppositeType(KEY_DATA[block[0]]?.type), requiredKey: null, pairKeys: [block[0]] };
  const pairKeys = block.slice(0, 2);
  if (block.length < limit * 2) {
    return { phase: 'repeat', limit, history, block, requiredType: KEY_DATA[pairKeys[block.length % 2]]?.type, requiredKey: pairKeys[block.length % 2], pairKeys };
  }
  return { phase: 'switch', limit, history, block, requiredType: KEY_DATA[block.at(-1)]?.type, requiredKey: null, pairKeys };
}

function loopCandidateAllowed(policy, previousKey, candidateKey) {
  const candidateType = KEY_DATA[candidateKey]?.type;
  if (!['L', 'R'].includes(candidateType)) return false;
  if (policy.phase === 'start') return true;
  if (policy.phase === 'repeat') return candidateKey === policy.requiredKey;
  if (candidateType !== policy.requiredType) return false;
  if (policy.phase === 'establish') return NEXT_RING_TABLE[candidateKey]?.includes(previousKey) === true;
  if (policy.phase === 'switch') {
    return candidateKey !== previousKey && (NEXT_RING_TABLE[candidateKey] || []).some(next =>
      KEY_DATA[next]?.type === oppositeType(candidateType) && NEXT_RING_TABLE[next]?.includes(candidateKey));
  }
  return false;
}

export function straightAntiRollEnabled(alignmentType, allowedTypes = []) {
  return alignmentType === 'straight' && allowedTypes.includes('L') && allowedTypes.includes('R');
}

export function nextStraightAntiRollKey(previousKey) {
  const index = STRAIGHT_ANTI_ROLL_CYCLE.indexOf(previousKey);
  return index < 0 ? null : STRAIGHT_ANTI_ROLL_CYCLE[(index + 1) % STRAIGHT_ANTI_ROLL_CYCLE.length];
}

export function straightAntiRollMeta(previousKey, candidateKey, recentKeys = [], maxPairLoops = DEFAULT_MAX_PAIR_LOOPS) {
  const expectedKey = nextStraightAntiRollKey(previousKey);
  const cycleIndex = STRAIGHT_ANTI_ROLL_CYCLE.indexOf(candidateKey);
  const candidateType = KEY_DATA[candidateKey]?.type;
  const previousType = KEY_DATA[previousKey]?.type;
  const alternatesType = !['L', 'R'].includes(previousType) ||
    (previousType === 'L' && candidateType === 'R') || (previousType === 'R' && candidateType === 'L');
  const followsCycle = expectedKey === candidateKey;
  const policy = straightLoopPolicy(previousKey, recentKeys, maxPairLoops);
  const limit = policy.limit;
  const recent = policy.history;
  const loopAllowed = loopCandidateAllowed(policy, previousKey, candidateKey);
  const pairLoopCount = policy.phase === 'repeat' ? Math.floor((policy.block.length + 1) / 2) : policy.phase === 'establish' ? 1 : Math.floor(policy.block.length / 2);
  const loopLimitExceeded = !loopAllowed;
  const changedPairAfterLimit = policy.phase === 'switch' && loopAllowed;
  const lastUseDistance = [...recent].reverse().findIndex(key => key === candidateKey);
  const repeatsPair = policy.phase === 'repeat' && loopAllowed;
  let sameTypeRun = 1;
  for (let index=recent.length-1; index>=0 && KEY_DATA[recent[index]]?.type===candidateType; index--) sameTypeRun++;

  // This is a preference, not a safety override. Hard Gap, suitability and
  // alignment constraints in the planner still carry much larger costs.
  const alternationPenalty = loopAllowed ? 0 : 20_000;
  const cyclePenalty = policy.phase !== 'repeat' && expectedKey && !followsCycle ? 2_500 : 0;
  const recentKeyPenalty = lastUseDistance >= 0 && lastUseDistance < 8 ? (8 - lastUseDistance) * 450 : 0;
  const repeatedPairPenalty = loopLimitExceeded ? 1_000_000_000 : 0;
  const longSameTypePenalty = sameTypeRun > 2 ? (sameTypeRun - 2) * 20_000 : 0;
  const penalty = alternationPenalty + cyclePenalty + recentKeyPenalty + repeatedPairPenalty + longSameTypePenalty;

  return {
    expectedKey,
    followsCycle,
    alternatesType,
    repeatsPair, pairLoopCount, maxPairLoops: limit, loopAllowed, loopLimitExceeded, changedPairAfterLimit,
    loopPhase: policy.phase, pairKeys: policy.pairKeys, requiredKey: policy.requiredKey, requiredType: policy.requiredType,
    penalty, alternationPenalty, cyclePenalty, recentKeyPenalty, repeatedPairPenalty, longSameTypePenalty, sameTypeRun,
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

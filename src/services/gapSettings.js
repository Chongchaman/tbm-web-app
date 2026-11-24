export const DEFAULT_GAP_SETTINGS = Object.freeze({
  initialGapTop: 40,
  initialGapBottom: 40,
  initialGapLeft: 40,
  initialGapRight: 40,
  warnThreshold: 15,
  criticalThreshold: 5,
  highWarnThreshold: 70,
  shieldLength: 4.2,
});

const finite = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

/** Repair incomplete or legacy cloud settings without blocking the planning screens. */
export function normalizeGapSettings(settings) {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const normalized = { ...DEFAULT_GAP_SETTINGS };
  for (const key of ['initialGapTop', 'initialGapBottom', 'initialGapLeft', 'initialGapRight']) {
    if (finite(source[key]) && Number(source[key]) >= 0 && Number(source[key]) <= 100) normalized[key] = Number(source[key]);
  }
  const warning = Number(source.warnThreshold);
  const critical = Number(source.criticalThreshold);
  if (finite(source.warnThreshold) && finite(source.criticalThreshold) && critical >= 0 && warning > critical) {
    normalized.warnThreshold = warning;
    normalized.criticalThreshold = critical;
  }
  const highWarn = Number(source.highWarnThreshold);
  if (finite(source.highWarnThreshold) && highWarn > normalized.warnThreshold) {
    normalized.highWarnThreshold = highWarn;
  }
  if (finite(source.shieldLength) && Number(source.shieldLength) > 0) normalized.shieldLength = Number(source.shieldLength);
  return normalized;
}

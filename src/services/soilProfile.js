import sheets from '../data/soilProfileGrid.json' with { type: 'json' };
import tunnelProfiles from '../data/tunnelProfile.json' with { type: 'json' };

export const SOIL_SOURCE = 'D-1-BT-TUNL-4001-001-B.pdf';
export const SOIL_TRACKS = ['EB', 'WB'];
export const SOIL_LIMITS = {
  EB: { start: 18400, end: 23390.269, pages: '14–21' },
  WB: { start: 18400, end: 23396.443, pages: '35–42' },
};
export const SOIL_CLASSES = {
  S: { label: 'ดินเหนียวอ่อน', english: 'Soft clay', color: '#79c4d6' },
  M: { label: 'ดินเหนียวแข็งปานกลาง', english: 'Medium stiff clay', color: '#c2d63b' },
  C: { label: 'ดินเหนียวแข็ง', english: 'Stiff clay', color: '#de8992' },
  A: { label: 'ทรายปนดิน/ทรายแน่น', english: 'Silty/clayey sand', color: '#ebc972' },
};

export function stationMeters(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!text) return null;
  const match = text.match(/^(\d+)\+(\d+(?:\.\d+)?)$/);
  if (match) return Number(match[1]) * 1000 + Number(match[2]);
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

export function formatSTA(value) {
  const meters = stationMeters(value);
  if (meters === null) return '—';
  const km = Math.floor(meters / 1000);
  return `${String(km).padStart(2, '0')}+${(meters % 1000).toFixed(3).padStart(7, '0')}`;
}

export function clampSoilStation(value, track) {
  const limit = SOIL_LIMITS[track] || SOIL_LIMITS.EB;
  const meters = stationMeters(value);
  return Math.min(limit.end, Math.max(limit.start, meters ?? limit.start));
}

export function soilLevelAtStation(levels, stations, track, station) {
  const savedStation = stationMeters(stations?.[track]);
  const requestedStation = stationMeters(station);
  return savedStation !== null && requestedStation !== null && Math.abs(savedStation - requestedStation) < 0.5
    ? levels?.[track] ?? '' : '';
}

export function soilSheetAt(station, track) {
  const meters = stationMeters(station);
  if (meters === null || !SOIL_TRACKS.includes(track)) return null;
  return sheets.find(sheet => sheet.track === track && meters >= sheet.start - 0.000001 &&
    (meters < sheet.end - 0.000001 || Math.abs(meters - sheet.end) < 0.000001 &&
      !sheets.some(next => next.track === track && Math.abs(next.start - meters) < 0.000001))) || null;
}

function nearestSample(sheet, station) {
  return sheet.samples.reduce((best, next) => Math.abs(next[0] - station) < Math.abs(best[0] - station) ? next : best);
}

function sampleCode(sheet, station, elevation) {
  const sample = nearestSample(sheet, station);
  const index = Math.round(sheet.maxElevation - elevation);
  return sample[1][index] || '?';
}

export function tunnelElevationAt(station, track) {
  const meters = stationMeters(station);
  const rows = tunnelProfiles[track] || [];
  if (meters === null || !rows.length || meters < rows[0][0] || meters > rows.at(-1)[0]) return null;
  let rightIndex = rows.findIndex(row => row[0] >= meters);
  if (rightIndex < 0) rightIndex = rows.length - 1;
  const right = rows[rightIndex];
  const left = rows[Math.max(0, rightIndex - 1)];
  const page = soilSheetAt(meters, track)?.page;
  if (left[0] === right[0]) return { elevation: right[1], page: page || right[2], station: meters };
  const ratio = (meters - left[0]) / (right[0] - left[0]);
  return { elevation: left[1] + ratio * (right[1] - left[1]), page: page || (ratio < 0.5 ? left[2] : right[2]), station: meters };
}

export function soilAt(station, track, elevation) {
  const sheet = soilSheetAt(station, track);
  if (!sheet) return { status: 'outside', sheet: null };
  if (elevation === '' || elevation === null || elevation === undefined) return { status: 'needs-elevation', sheet };
  const level = Number(elevation);
  if (!Number.isFinite(level) || level < sheet.minElevation || level > sheet.maxElevation) return { status: 'elevation-outside', sheet };
  const meters = stationMeters(station);
  const nearest = nearestSample(sheet, meters);
  const code = sampleCode(sheet, meters, level);
  if (!SOIL_CLASSES[code]) return { status: 'unclear', sheet, sampledSTA: nearest[0], elevation: level };
  const neighbors = [level - 1, level + 1].filter(value => value >= sheet.minElevation && value <= sheet.maxElevation)
    .map(value => sampleCode(sheet, meters, value));
  const stationNeighbors = sheet.samples.filter(sample => Math.abs(sample[0] - nearest[0]) <= 20.01 && sample !== nearest)
    .map(sample => sample[1][Math.round(sheet.maxElevation - level)] || '?');
  const boundary = [...neighbors, ...stationNeighbors].some(other => other !== code);
  return { status: boundary ? 'boundary' : 'interpreted', code, soil: SOIL_CLASSES[code], sheet,
    sampledSTA: nearest[0], elevation: level };
}

export function soilColumnAt(station, track, step = 5) {
  const sheet = soilSheetAt(station, track);
  if (!sheet) return [];
  const meters = stationMeters(station);
  const nearest = nearestSample(sheet, meters);
  return Array.from({ length: Math.floor((sheet.maxElevation - sheet.minElevation) / step) + 1 }, (_, index) => {
    const elevation = sheet.maxElevation - index * step;
    const code = nearest[1][index * step] || '?';
    return { elevation, code, soil: SOIL_CLASSES[code] || null };
  });
}

export function soilProfileRange(startValue, endValue, track, maximumColumns = 160) {
  let start = clampSoilStation(startValue, track);
  let end = clampSoilStation(endValue, track);
  if (start > end) [start, end] = [end, start];
  const candidates = sheets.filter(sheet => sheet.track === track && sheet.end >= start && sheet.start <= end)
    .flatMap(sheet => sheet.samples.map(sample => ({ station: sample[0], codes: sample[1], minElevation: sheet.minElevation, maxElevation: sheet.maxElevation, page: sheet.page, drawing: sheet.drawing })))
    .filter(sample => sample.station >= start - 0.001 && sample.station <= end + 0.001);
  const step = Math.max(1, Math.ceil(candidates.length / maximumColumns));
  const columns = candidates.filter((_, index) => index % step === 0);
  for (const station of [start, end]) {
    const sheet = soilSheetAt(station, track);
    if (!sheet || columns.some(column => Math.abs(column.station - station) < 0.001)) continue;
    const sample = nearestSample(sheet, station);
    columns.push({ station, codes: sample[1], minElevation: sheet.minElevation, maxElevation: sheet.maxElevation, page: sheet.page, drawing: sheet.drawing });
  }
  return columns.sort((a, b) => a.station - b.station);
}

export function tunnelProfileRange(startValue, endValue, track) {
  let start = clampSoilStation(startValue, track);
  let end = clampSoilStation(endValue, track);
  if (start > end) [start, end] = [end, start];
  const rows = (tunnelProfiles[track] || []).filter(row => row[0] >= start && row[0] <= end);
  const boundaries = [tunnelElevationAt(start, track), tunnelElevationAt(end, track)].filter(Boolean)
    .map(point => [point.station, point.elevation, point.page]);
  return [...boundaries, ...rows].sort((a, b) => a[0] - b[0]).filter((row, index, all) => !index || row[0] !== all[index - 1][0]);
}

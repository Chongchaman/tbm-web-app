import sheets from '../data/soilProfileGrid.json' with { type: 'json' };

export const SOIL_SOURCE = 'D-1-BT-TUNL-4001-001-B.pdf';
export const SOIL_TRACKS = ['EB', 'WB'];
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

export function soilSheetAt(station, track) {
  const meters = stationMeters(station);
  if (meters === null || !SOIL_TRACKS.includes(track)) return null;
  return sheets.find(sheet => sheet.track === track && meters >= sheet.start - 0.000001 &&
    (meters < sheet.end - 0.000001 || Math.abs(meters - sheet.end) < 0.000001 &&
      !sheets.some(next => next.track === track && Math.abs(next.start - meters) < 0.000001))) || null;
}

function sampleCode(sheet, station, elevation) {
  const sample = sheet.samples.reduce((best, next) => Math.abs(next[0] - station) < Math.abs(best[0] - station) ? next : best);
  const index = Math.round(105 - elevation);
  return sample[1][index] || '?';
}

export function soilAt(station, track, elevation) {
  const sheet = soilSheetAt(station, track);
  if (!sheet) return { status: 'outside', sheet: null };
  if (elevation === '' || elevation === null || elevation === undefined) return { status: 'needs-elevation', sheet };
  const level = Number(elevation);
  if (!Number.isFinite(level) || level < 30 || level > 105) return { status: 'elevation-outside', sheet };
  const meters = stationMeters(station);
  const nearest = sheet.samples.reduce((best, next) => Math.abs(next[0] - meters) < Math.abs(best[0] - meters) ? next : best);
  const code = sampleCode(sheet, meters, level);
  if (!SOIL_CLASSES[code]) return { status: 'unclear', sheet };
  const neighbors = [level - 1, level + 1].filter(value => value >= 30 && value <= 105)
    .map(value => sampleCode(sheet, meters, value));
  const stationNeighbors = sheet.samples.filter(sample => Math.abs(sample[0] - nearest[0]) <= 20.01 && sample !== nearest)
    .map(sample => sample[1][Math.round(105 - level)] || '?');
  const boundary = [...neighbors, ...stationNeighbors].some(other => other !== code);
  return { status: boundary ? 'boundary' : 'interpreted', code, soil: SOIL_CLASSES[code], sheet,
    sampledSTA: nearest[0], elevation: level };
}

export function soilColumnAt(station, track) {
  const sheet = soilSheetAt(station, track);
  if (!sheet) return [];
  const meters = stationMeters(station);
  const nearest = sheet.samples.reduce((best, next) => Math.abs(next[0] - meters) < Math.abs(best[0] - meters) ? next : best);
  // A five-metre step communicates the drawing's vertical sequence without implying
  // millimetre-level certainty from a rendered, coloured profile.
  return Array.from({ length: 16 }, (_, index) => {
    const elevation = 105 - index * 5;
    const code = nearest[1][index * 5] || '?';
    return { elevation, code, soil: SOIL_CLASSES[code] || null };
  });
}

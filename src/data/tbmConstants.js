// ============================================================
//  TBM Ring Segment Planner — Constants & Master Data
//  Project: MRT Purple Line / MWA-9D TBM#34
// ============================================================

export const TBM_SPECS = {
  PROJECT_NAME: 'MRT Purple Line / MWA-9D TBM#34',
  TBM_DIAMETER: 6610,      // mm
  SEGMENT_OD: 6000,        // mm
  SEGMENT_ID: 5400,        // mm
  SEGMENT_WIDTH_DEFAULT: 1400, // mm
  SEGMENT_WIDTH_ALT: 1200,     // mm
  MAX_TAPER: 60.0,         // mm
  JACK_SPEED_DEFAULT: 40.0,// mm/min
  ARTICULATION_DISTANCE: 9.98, // m (for articulation calculation)
};

// 33 Standard Keys geometry (H-lead, V-lead in mm)
export const KEY_DATA = {
  // Right Tapered (R)
  R1:  { key: 'R1',  type: 'R', pos: 1,  hLead: -55.43, vLead: 22.96,  angle: 0.0 },
  R2:  { key: 'R2',  type: 'R', pos: 2,  hLead: -60.00, vLead: 0.00,   angle: 22.5 },
  R3:  { key: 'R3',  type: 'R', pos: 3,  hLead: -55.43, vLead: -22.96, angle: 45.0 },
  R4:  { key: 'R4',  type: 'R', pos: 4,  hLead: -42.43, vLead: -42.43, angle: 67.5 },
  R5:  { key: 'R5',  type: 'R', pos: 5,  hLead: -22.96, vLead: -55.43, angle: 90.0 },
  R6:  { key: 'R6',  type: 'R', pos: 6,  hLead: 0.00,   vLead: -60.00, angle: 112.5 },
  R12: { key: 'R12', type: 'R', pos: 12, hLead: 42.43,  vLead: 42.43,  angle: 247.5 },
  R13: { key: 'R13', type: 'R', pos: 13, hLead: 22.96,  vLead: 55.43,  angle: 270.0 },
  R14: { key: 'R14', type: 'R', pos: 14, hLead: 0.00,   vLead: 60.00,  angle: 292.5 },
  R15: { key: 'R15', type: 'R', pos: 15, hLead: -22.96, vLead: 55.43,  angle: 315.0 },
  R16: { key: 'R16', type: 'R', pos: 16, hLead: -42.43, vLead: 42.43,  angle: 337.5 },

  // Left Tapered (L)
  L1:  { key: 'L1',  type: 'L', pos: 1,  hLead: 55.43,  vLead: 22.96,  angle: 0.0 },
  L2:  { key: 'L2',  type: 'L', pos: 2,  hLead: 42.43,  vLead: 42.43,  angle: 22.5 },
  L3:  { key: 'L3',  type: 'L', pos: 3,  hLead: 22.96,  vLead: 55.43,  angle: 45.0 },
  L4:  { key: 'L4',  type: 'L', pos: 4,  hLead: 0.00,   vLead: 60.00,  angle: 67.5 },
  L5:  { key: 'L5',  type: 'L', pos: 5,  hLead: -22.96, vLead: 55.43,  angle: 90.0 },
  L6:  { key: 'L6',  type: 'L', pos: 6,  hLead: -42.43, vLead: 42.43,  angle: 112.5 },
  L12: { key: 'L12', type: 'L', pos: 12, hLead: 0.00,   vLead: -60.00, angle: 247.5 },
  L13: { key: 'L13', type: 'L', pos: 13, hLead: 22.96,  vLead: -55.43, angle: 270.0 },
  L14: { key: 'L14', type: 'L', pos: 14, hLead: 42.43,  vLead: -42.43, angle: 292.5 },
  L15: { key: 'L15', type: 'L', pos: 15, hLead: 55.43,  vLead: -22.96, angle: 315.0 },
  L16: { key: 'L16', type: 'L', pos: 16, hLead: 60.00,  vLead: 0.00,   angle: 337.5 },

  // Universal (U)
  U1:  { key: 'U1',  type: 'U', pos: 1,  hLead: 0.00,   vLead: 60.00,  angle: 0.0 },
  U2:  { key: 'U2',  type: 'U', pos: 2,  hLead: -22.96, vLead: 55.44,  angle: 22.5 },
  U3:  { key: 'U3',  type: 'U', pos: 3,  hLead: -42.42, vLead: 42.42,  angle: 45.0 },
  U4:  { key: 'U4',  type: 'U', pos: 4,  hLead: -55.44, vLead: 22.96,  angle: 67.5 },
  U5:  { key: 'U5',  type: 'U', pos: 5,  hLead: -60.00, vLead: 0.00,   angle: 90.0 },
  U6:  { key: 'U6',  type: 'U', pos: 6,  hLead: -55.44, vLead: -22.96, angle: 112.5 },
  U12: { key: 'U12', type: 'U', pos: 12, hLead: 55.44,  vLead: -22.96, angle: 247.5 },
  U13: { key: 'U13', type: 'U', pos: 13, hLead: 60.00,  vLead: 0.00,   angle: 270.0 },
  U14: { key: 'U14', type: 'U', pos: 14, hLead: 55.44,  vLead: 22.96,  angle: 292.5 },
  U15: { key: 'U15', type: 'U', pos: 15, hLead: 42.42,  vLead: 42.42,  angle: 315.0 },
  U16: { key: 'U16', type: 'U', pos: 16, hLead: 22.96,  vLead: 55.44,  angle: 337.5 },
};

// Next Ring Candidate Keys mapped per Current Key from Plan Sheet (Columns R..AF)
export const NEXT_RING_TABLE = {
  R1:  ['L3', 'L6', 'L12', 'L15', 'R3', 'R6', 'R12', 'R15', 'U3', 'U6', 'U12', 'U15'],
  R2:  ['L4', 'L13', 'L16', 'R4', 'R13', 'R16', 'U4', 'U13', 'U16'],
  R3:  ['L1', 'L5', 'L14', 'R1', 'R5', 'R14', 'U1', 'U5', 'U14'],
  R4:  ['L2', 'L6', 'L12', 'L15', 'R2', 'R6', 'R12', 'R15', 'U2', 'U6', 'U12', 'U15'],
  R5:  ['L3', 'L13', 'L16', 'R3', 'R13', 'R16', 'U3', 'U13', 'U16'],
  R6:  ['L1', 'L4', 'L14', 'R1', 'R4', 'R14', 'U1', 'U4', 'U14'],
  R12: ['L1', 'L4', 'L14', 'R1', 'R4', 'R14', 'U1', 'U4', 'U14'],
  R13: ['L2', 'L5', 'L15', 'R2', 'R5', 'R15', 'U2', 'U5', 'U15'],
  R14: ['L3', 'L6', 'L12', 'L16', 'R3', 'R6', 'R12', 'R16', 'U3', 'U6', 'U12', 'U16'],
  R15: ['L1', 'L4', 'L13', 'R1', 'R4', 'R13', 'U1', 'U4', 'U13'],
  R16: ['L2', 'L5', 'L14', 'R2', 'R5', 'R14', 'U2', 'U5', 'U14'],

  L1:  ['L3', 'L6', 'L12', 'L15', 'R3', 'R6', 'R12', 'R15', 'U3', 'U6', 'U12', 'U15'],
  L2:  ['L4', 'L13', 'L16', 'R4', 'R13', 'R16', 'U4', 'U13', 'U16'],
  L3:  ['L1', 'L5', 'L14', 'R1', 'R5', 'R14', 'U1', 'U5', 'U14'],
  L4:  ['L2', 'L6', 'L12', 'L15', 'R2', 'R6', 'R12', 'R15', 'U2', 'U6', 'U12', 'U15'],
  L5:  ['L3', 'L13', 'L16', 'R3', 'R13', 'R16', 'U3', 'U13', 'U16'],
  L6:  ['L1', 'L4', 'L14', 'R1', 'R4', 'R14', 'U1', 'U4', 'U14'],
  L12: ['L1', 'L4', 'L14', 'R1', 'R4', 'R14', 'U1', 'U4', 'U14'],
  L13: ['L2', 'L5', 'L15', 'R2', 'R5', 'R15', 'U2', 'U5', 'U15'],
  L14: ['L3', 'L6', 'L12', 'L16', 'R3', 'R6', 'R12', 'R16', 'U3', 'U6', 'U12', 'U16'],
  L15: ['L1', 'L4', 'L13', 'R1', 'R4', 'R13', 'U1', 'U4', 'U13'],
  L16: ['L2', 'L5', 'L14', 'R2', 'R5', 'R14', 'U2', 'U5', 'U14'],

  U1:  ['L3', 'L6', 'L12', 'L15', 'R3', 'R6', 'R12', 'R15'],
  U2:  ['L4', 'L13', 'L16', 'R4', 'R13', 'R16', 'U4', 'U13', 'U16'],
  U3:  ['L1', 'L5', 'L14', 'R1', 'R5', 'R14', 'U1', 'U5', 'U14'],
  U4:  ['L2', 'L6', 'L12', 'L15', 'R2', 'R6', 'R12', 'R15', 'U2', 'U6', 'U12', 'U15'],
  U5:  ['L3', 'L13', 'L16', 'R3', 'R13', 'R16', 'U3', 'U13', 'U16'],
  U6:  ['L1', 'L4', 'L14', 'R1', 'R4', 'R14', 'U1', 'U4', 'U14'],
  U12: ['L1', 'L4', 'L14', 'R1', 'R4', 'R14', 'U1', 'U4', 'U14'],
  U13: ['L2', 'L5', 'L15', 'R2', 'R5', 'R15', 'U2', 'U5', 'U15'],
  U14: ['L3', 'L6', 'L12', 'L16', 'R3', 'R6', 'R12', 'R16', 'U3', 'U6', 'U12', 'U16'],
  U15: ['L1', 'L4', 'L13', 'R1', 'R4', 'R13', 'U1', 'U4', 'U13'],
  U16: ['L2', 'L5', 'L14', 'R2', 'R5', 'R14', 'U2', 'U5', 'U14'],
};

// Bolt Connection Suitability Matrix (Key 1..16 vs 1..16 from Plan Sheet Columns AL..BB)
export const SUITABILITY_MATRIX = {
  1:  { 1:'No', 2:'Fair', 3:'Yes', 4:'No', 5:'No', 6:'Yes', 12:'Yes', 13:'No', 14:'No', 15:'Yes', 16:'Fair' },
  2:  { 1:'Fair', 2:'No', 3:'Fair', 4:'Yes', 5:'No', 6:'No', 12:'No', 13:'Yes', 14:'No', 15:'No', 16:'Yes' },
  3:  { 1:'Yes', 2:'Fair', 3:'No', 4:'Fair', 5:'Yes', 6:'No', 12:'No', 13:'No', 14:'Yes', 15:'No', 16:'No' },
  4:  { 1:'No', 2:'Yes', 3:'Fair', 4:'No', 5:'Fair', 6:'Yes', 12:'Yes', 13:'No', 14:'No', 15:'Yes', 16:'No' },
  5:  { 1:'No', 2:'No', 3:'Yes', 4:'Fair', 5:'No', 6:'Fair', 12:'No', 13:'Yes', 14:'No', 15:'No', 16:'Yes' },
  6:  { 1:'Yes', 2:'No', 3:'No', 4:'Yes', 5:'Fair', 6:'No', 12:'No', 13:'No', 14:'Yes', 15:'No', 16:'No' },
  7:  { 1:'No', 2:'Yes', 3:'No', 4:'No', 5:'Yes', 6:'Fair', 12:'Yes', 13:'No', 14:'No', 15:'Yes', 16:'No' },
  8:  { 1:'No', 2:'No', 3:'Yes', 4:'No', 5:'No', 6:'Yes', 12:'No', 13:'Yes', 14:'No', 15:'No', 16:'Yes' },
  9:  { 1:'Yes', 2:'No', 3:'No', 4:'Yes', 5:'No', 6:'No', 12:'No', 13:'No', 14:'Yes', 15:'No', 16:'No' },
  10: { 1:'No', 2:'Yes', 3:'No', 4:'No', 5:'Yes', 6:'No', 12:'Yes', 13:'No', 14:'No', 15:'Yes', 16:'No' },
  11: { 1:'No', 2:'No', 3:'Yes', 4:'No', 5:'No', 6:'Yes', 12:'Fair', 13:'Yes', 14:'No', 15:'No', 16:'Yes' },
  12: { 1:'Yes', 2:'No', 3:'No', 4:'Yes', 5:'No', 6:'No', 12:'No', 13:'Fair', 14:'Yes', 15:'No', 16:'No' },
  13: { 1:'No', 2:'Yes', 3:'No', 4:'No', 5:'Yes', 6:'No', 12:'Fair', 13:'No', 14:'Fair', 15:'Yes', 16:'No' },
  14: { 1:'No', 2:'No', 3:'Yes', 4:'No', 5:'No', 6:'Yes', 12:'Yes', 13:'Fair', 14:'No', 15:'Fair', 16:'Yes' },
  15: { 1:'Yes', 2:'No', 3:'No', 4:'Yes', 5:'No', 6:'No', 12:'No', 13:'Yes', 14:'Fair', 15:'No', 16:'Fair' },
  16: { 1:'Fair', 2:'Yes', 3:'No', 4:'No', 5:'Yes', 6:'No', 12:'No', 13:'No', 14:'Yes', 15:'Fair', 16:'No' },
};

// Curve Lead Offset Presets (from Plan Sheet Rows 19..33)
export const CURVE_OFFSET_PRESETS = [
  { width: 1400, radius: 1000, dir: 'R', hLead: 8.82,  vLead: -8.82 },
  { width: 1400, radius: 1000, dir: 'L', hLead: -8.82, vLead: 8.82 },
  { width: 1400, radius: 500,  dir: 'R', hLead: 17.64, vLead: -17.64 },
  { width: 1400, radius: 500,  dir: 'L', hLead: -17.64, vLead: 17.64 },
  { width: 1400, radius: 300,  dir: 'R', hLead: 29.40, vLead: -29.40 },
  { width: 1400, radius: 300,  dir: 'L', hLead: -29.40, vLead: 29.40 },
  { width: 1400, radius: 200,  dir: 'R', hLead: 44.10, vLead: -44.10 },
  { width: 1400, radius: 200,  dir: 'L', hLead: -44.10, vLead: 44.10 },
  { width: 1400, radius: 160,  dir: 'R', hLead: 55.125, vLead: -55.125 },
  { width: 1400, radius: 160,  dir: 'L', hLead: -55.125, vLead: 55.125 },

  { width: 1200, radius: 1000, dir: 'R', hLead: 7.56,  vLead: -7.56 },
  { width: 1200, radius: 1000, dir: 'L', hLead: -7.56, vLead: 7.56 },
  { width: 1200, radius: 500,  dir: 'R', hLead: 15.12, vLead: -15.12 },
  { width: 1200, radius: 500,  dir: 'L', hLead: -15.12, vLead: 15.12 },
  { width: 1200, radius: 300,  dir: 'R', hLead: 25.20, vLead: -25.20 },
  { width: 1200, radius: 300,  dir: 'L', hLead: -25.20, vLead: 25.20 },
  { width: 1200, radius: 200,  dir: 'R', hLead: 37.80, vLead: -37.80 },
  { width: 1200, radius: 200,  dir: 'L', hLead: -37.80, vLead: 37.80 },
  { width: 1200, radius: 160,  dir: 'R', hLead: 47.25, vLead: -47.25 },
  { width: 1200, radius: 160,  dir: 'L', hLead: -47.25, vLead: 47.25 },
];

// Initial Ring Log preloaded directly from the Google Sheet (Rows 3..17)
export const INITIAL_RING_LOGS = [
  { ringNum: 'R0001', key: 'L2',  hLead: -40.00, vLead: 0.00,   gapT: 95, gapB: 92, gapL: 88, gapR: 90, roll: 0.2, pitch: -0.1, timestamp: '2026-08-01 08:30', notes: 'Initial ring installation' },
  { ringNum: 'R0002', key: 'R13', hLead: -17.04, vLead: 55.43,  gapT: 92, gapB: 94, gapL: 89, gapR: 91, roll: 0.1, pitch: 0.0,  timestamp: '2026-08-01 14:15', notes: 'Smooth alignment' },
  { ringNum: 'R0003', key: 'L15', hLead: 38.39,  vLead: 32.47,  gapT: 90, gapB: 90, gapL: 95, gapR: 85, roll: -0.2, pitch: 0.1, timestamp: '2026-08-02 09:00', notes: 'Right side correction' },
  { ringNum: 'R0004', key: 'R4',  hLead: -4.04,  vLead: -9.96,  gapT: 94, gapB: 88, gapL: 92, gapR: 90, roll: 0.0, pitch: -0.2, timestamp: '2026-08-02 16:45', notes: 'Near zero drift' },
  { ringNum: 'R0005', key: 'L2',  hLead: 38.39,  vLead: 32.47,  gapT: 89, gapB: 93, gapL: 90, gapR: 92, roll: 0.3, pitch: 0.0,  timestamp: '2026-08-03 10:20', notes: 'Target adjustment' },
  { ringNum: 'R0006', key: 'R4',  hLead: -4.04,  vLead: -9.96,  gapT: 91, gapB: 91, gapL: 89, gapR: 93, roll: 0.1, pitch: 0.1,  timestamp: '2026-08-03 18:00', notes: 'Stable push' },
  { ringNum: 'R0007', key: 'L2',  hLead: 38.39,  vLead: 32.47,  gapT: 93, gapB: 89, gapL: 94, gapR: 88, roll: -0.1, pitch: -0.1, timestamp: '2026-08-04 07:30', notes: 'Normal ring building' },
  { ringNum: 'R0008', key: 'R4',  hLead: -4.04,  vLead: -9.96,  gapT: 90, gapB: 92, gapL: 91, gapR: 91, roll: 0.2, pitch: 0.0,  timestamp: '2026-08-04 15:10', notes: 'Optimal lead' },
  { ringNum: 'R0009', key: 'L15', hLead: 51.39,  vLead: -32.92, gapT: 88, gapB: 95, gapL: 96, gapR: 86, roll: 0.4, pitch: 0.2,  timestamp: '2026-08-05 08:45', notes: 'Curve transition' },
  { ringNum: 'R0010', key: 'R1',  hLead: -4.04,  vLead: -9.96,  gapT: 92, gapB: 90, gapL: 90, gapR: 92, roll: 0.0, pitch: -0.1, timestamp: '2026-08-05 16:30', notes: 'Re-centered' },
  { ringNum: 'R0011', key: 'R15', hLead: -27.00, vLead: 45.47,  gapT: 95, gapB: 87, gapL: 88, gapR: 94, roll: -0.2, pitch: 0.1, timestamp: '2026-08-06 09:15', notes: 'Vertical adjustment' },
  { ringNum: 'R0012', key: 'L13', hLead: -4.04,  vLead: -9.96,  gapT: 89, gapB: 93, gapL: 93, gapR: 89, roll: 0.1, pitch: 0.0,  timestamp: '2026-08-06 17:00', notes: 'Counterbalance' },
  { ringNum: 'R0013', key: 'L2',  hLead: 38.39,  vLead: 32.47,  gapT: 94, gapB: 88, gapL: 91, gapR: 91, roll: 0.2, pitch: -0.1, timestamp: '2026-08-07 08:00', notes: 'Planned Key selected' },
  { ringNum: 'R0014', key: 'R4',  hLead: -4.04,  vLead: -9.96,  gapT: 91, gapB: 91, gapL: 90, gapR: 92, roll: -0.1, pitch: 0.1, timestamp: '2026-08-07 14:40', notes: 'Zero correction' },
  { ringNum: 'R0015', key: 'L2',  hLead: 38.39,  vLead: 32.47,  gapT: 92, gapB: 90, gapL: 92, gapR: 90, roll: 0.0, pitch: 0.0,  timestamp: '2026-08-08 10:15', notes: 'Latest completed ring' },
];

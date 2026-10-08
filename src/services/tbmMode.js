export const TBM_MODES = {
  EB: { machine: 'TBM1', track: 'EB', title: 'TBM1 · EB' },
  WB: { machine: 'TBM2', track: 'WB', title: 'TBM2 · WB' },
};

export const tbmMode = track => TBM_MODES[track] || TBM_MODES.EB;

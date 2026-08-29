import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

export default function GapVisualizer({
  gapT = 90,
  gapB = 90,
  gapL = 90,
  gapR = 90,
  warnThreshold = 80,
  blockThreshold = 65,
  nominal = 90,
  editable = false,
  onChange = () => {},
}) {
  const getStatus = (val) => {
    const num = Number(val);
    if (isNaN(num)) return { text: 'text-zinc-400', border: 'border-zinc-700', bg: 'bg-zinc-800', level: 'unknown' };
    if (num <= blockThreshold) return { text: 'text-rose-400', border: 'border-rose-500', bg: 'bg-rose-500/10', level: 'critical' };
    if (num <= warnThreshold) return { text: 'text-amber-400', border: 'border-amber-500', bg: 'bg-amber-500/10', level: 'warning' };
    return { text: 'text-emerald-400', border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', level: 'safe' };
  };

  const statusT = getStatus(gapT);
  const statusB = getStatus(gapB);
  const statusL = getStatus(gapL);
  const statusR = getStatus(gapR);

  const deltaV = Number((Number(gapT) - Number(gapB)).toFixed(1));
  const deltaH = Number((Number(gapL) - Number(gapR)).toFixed(1));

  const hasCritical = [statusT, statusB, statusL, statusR].some(s => s.level === 'critical');
  const hasWarning = [statusT, statusB, statusL, statusR].some(s => s.level === 'warning');

  return (
    <div className="bg-surf-2 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text tracking-wide flex items-center gap-2">
            Tail Clearance & Gap Monitor
          </h4>
          <p className="text-xs text-text-muted">4-Quadrant TBM Tail Clearance (Nominal {nominal} mm)</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium">
          {hasCritical ? (
            <span className="flex items-center gap-1 text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
              <AlertOctagon size={13} /> Clearance Critical (&le;{blockThreshold}mm)
            </span>
          ) : hasWarning ? (
            <span className="flex items-center gap-1 text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
              <AlertTriangle size={13} /> Clearance Warning (&le;{warnThreshold}mm)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <ShieldCheck size={13} /> Clearance Normal
            </span>
          )}
        </div>
      </div>

      {/* Interactive 4-quadrant layout */}
      <div className="relative w-full max-w-[280px] h-[260px] mx-auto flex items-center justify-center">
        {/* Outer Circular Reference */}
        <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-surf-3/80 border border-white/15 flex flex-col items-center justify-center p-2 shadow-inner">
            <span className="text-[10px] text-text-muted uppercase font-mono tracking-wider">Eccentricity</span>
            <span className="text-xs font-mono font-bold text-acc">&Delta;H: {deltaH > 0 ? `+${deltaH}` : deltaH}</span>
            <span className="text-xs font-mono font-bold text-acc">&Delta;V: {deltaV > 0 ? `+${deltaV}` : deltaV}</span>
          </div>
        </div>

        {/* Top Gap */}
        <div className="absolute top-0 flex flex-col items-center">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-lg border font-mono font-bold text-sm shadow-md transition-colors ${statusT.bg} ${statusT.border} ${statusT.text}`}>
            <ArrowUp size={14} />
            {editable ? (
              <input
                type="number"
                value={gapT}
                onChange={(e) => onChange('gapT', e.target.value)}
                className="w-12 bg-transparent text-center outline-none border-b border-white/20 focus:border-acc"
              />
            ) : (
              <span>{gapT}</span>
            )}
            <span className="text-[10px] font-normal text-text-muted">mm</span>
          </div>
          <span className="text-[10px] text-text-muted mt-0.5">Top (T)</span>
        </div>

        {/* Bottom Gap */}
        <div className="absolute bottom-0 flex flex-col items-center">
          <span className="text-[10px] text-text-muted mb-0.5">Bottom (B)</span>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-lg border font-mono font-bold text-sm shadow-md transition-colors ${statusB.bg} ${statusB.border} ${statusB.text}`}>
            <ArrowDown size={14} />
            {editable ? (
              <input
                type="number"
                value={gapB}
                onChange={(e) => onChange('gapB', e.target.value)}
                className="w-12 bg-transparent text-center outline-none border-b border-white/20 focus:border-acc"
              />
            ) : (
              <span>{gapB}</span>
            )}
            <span className="text-[10px] font-normal text-text-muted">mm</span>
          </div>
        </div>

        {/* Left Gap */}
        <div className="absolute left-0 flex items-center gap-1">
          <span className="text-[10px] text-text-muted">L</span>
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono font-bold text-sm shadow-md transition-colors ${statusL.bg} ${statusL.border} ${statusL.text}`}>
            <ArrowLeft size={14} />
            {editable ? (
              <input
                type="number"
                value={gapL}
                onChange={(e) => onChange('gapL', e.target.value)}
                className="w-12 bg-transparent text-center outline-none border-b border-white/20 focus:border-acc"
              />
            ) : (
              <span>{gapL}</span>
            )}
          </div>
        </div>

        {/* Right Gap */}
        <div className="absolute right-0 flex items-center gap-1">
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-mono font-bold text-sm shadow-md transition-colors ${statusR.bg} ${statusR.border} ${statusR.text}`}>
            {editable ? (
              <input
                type="number"
                value={gapR}
                onChange={(e) => onChange('gapR', e.target.value)}
                className="w-12 bg-transparent text-center outline-none border-b border-white/20 focus:border-acc"
              />
            ) : (
              <span>{gapR}</span>
            )}
            <ArrowRight size={14} />
          </div>
          <span className="text-[10px] text-text-muted">R</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-text-muted border-t border-white/5 pt-3">
        <div className="flex justify-between">
          <span>H Balance (L-R):</span>
          <span className="font-mono font-semibold text-text">{deltaH > 0 ? `+${deltaH}` : deltaH} mm</span>
        </div>
        <div className="flex justify-between">
          <span>V Balance (T-B):</span>
          <span className="font-mono font-semibold text-text">{deltaV > 0 ? `+${deltaV}` : deltaV} mm</span>
        </div>
      </div>
    </div>
  );
}

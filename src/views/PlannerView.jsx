import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Sparkles, 
  ArrowRight, 
  Compass, 
  Check, 
  Save, 
  RotateCcw,
  Sliders,
  Layers,
  ChevronDown,
  Info,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import RingDiagram from '../components/RingDiagram';
import GapVisualizer from '../components/GapVisualizer';
import KeySuitabilityBadge from '../components/KeySuitabilityBadge';
import { calculateCandidates, calculateCurveOffset } from '../services/calculator';
import { KEY_DATA, CURVE_OFFSET_PRESETS } from '../data/tbmConstants';

export default function PlannerView({ ringLogs = [], onSaveRing = () => {} }) {
  // Derive previous ring default from latest log
  const lastRing = ringLogs.length > 0 ? ringLogs[ringLogs.length - 1] : null;
  const nextDefaultRingNum = lastRing ? `R${String(parseInt(lastRing.ringNum.replace(/\D/g, '') || '0') + 1).padStart(4, '0')}` : 'R0016';

  // Planner States
  const [ringNum, setRingNum] = useState(nextDefaultRingNum);
  const [beforeKey, setBeforeKey] = useState(lastRing ? lastRing.key : 'R13');
  const [beforeHLead, setBeforeHLead] = useState(lastRing ? lastRing.hLead : -17.04);
  const [beforeVLead, setBeforeVLead] = useState(lastRing ? lastRing.vLead : 55.43);
  
  // Curve states
  const [segWidth, setSegWidth] = useState(1400);
  const [curveRadius, setCurveRadius] = useState(0); // 0 = straight
  const [curveDir, setCurveDir] = useState('R');
  const [customCurveH, setCustomCurveH] = useState(0);
  const [customCurveV, setCustomCurveV] = useState(0);
  const [useCustomCurve, setUseCustomCurve] = useState(false);
  const [rollDeg, setRollDeg] = useState(0);

  // Selected candidate key
  const [selectedCandidateKey, setSelectedCandidateKey] = useState(null);
  const [hoveredCandidateKey, setHoveredCandidateKey] = useState(null);

  // Gap measurements for new ring
  const [gapT, setGapT] = useState(90);
  const [gapB, setGapB] = useState(90);
  const [gapL, setGapL] = useState(90);
  const [gapR, setGapR] = useState(90);
  const [notes, setNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Compute Curve Offset
  const computedCurve = useMemo(() => {
    if (useCustomCurve) {
      return { hLead: Number(customCurveH) || 0, vLead: Number(customCurveV) || 0, articulation: 0 };
    }
    return calculateCurveOffset(Number(curveRadius), Number(segWidth), curveDir);
  }, [useCustomCurve, customCurveH, customCurveV, curveRadius, segWidth, curveDir]);

  // Compute Candidate Next Keys
  const candidates = useMemo(() => {
    return calculateCandidates({
      beforeKey,
      beforeHLead: Number(beforeHLead) || 0,
      beforeVLead: Number(beforeVLead) || 0,
      curveHLead: computedCurve.hLead,
      curveVLead: computedCurve.vLead,
      targetH: 0,
      targetV: 0,
    });
  }, [beforeKey, beforeHLead, beforeVLead, computedCurve]);

  // Auto select best recommendation if none selected
  const activeKey = selectedCandidateKey || (candidates.length > 0 ? candidates[0].key : 'L2');
  const activeCandidateData = candidates.find(c => c.key === activeKey) || candidates[0];

  const handleSave = (e) => {
    e.preventDefault();
    if (!activeCandidateData) return;

    const newRecord = {
      ringNum,
      key: activeCandidateData.key,
      hLead: activeCandidateData.afterHLead,
      vLead: activeCandidateData.afterVLead,
      gapT: Number(gapT),
      gapB: Number(gapB),
      gapL: Number(gapL),
      gapR: Number(gapR),
      roll: Number(rollDeg),
      pitch: 0,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      notes: notes || `Planned with Before Key ${beforeKey}`,
    };

    onSaveRing(newRecord);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);

    // Increment to next ring
    const nextNum = `R${String(parseInt(ringNum.replace(/\D/g, '') || '0') + 1).padStart(4, '0')}`;
    setRingNum(nextNum);
    setBeforeKey(activeCandidateData.key);
    setBeforeHLead(activeCandidateData.afterHLead);
    setBeforeVLead(activeCandidateData.afterVLead);
    setSelectedCandidateKey(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surf-2 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-acc/15 text-acc border border-acc/30">
              PLANNING ENGINE
            </span>
            <span className="text-xs text-text-muted">MRT Purple Line / MWA-9D</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">Ring Segment Selection & Lead Optimization</h2>
          <p className="text-sm text-text-muted mt-1">
            Calculate next ring candidate keys, verify bolt suitability matrix, and predict after-ring alignment leads.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-sm font-medium animate-bounce">
            <Check size={18} />
            <span>Ring Saved to Log Successfully!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Ring & Previous Ring Specs */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-acc uppercase tracking-wider flex items-center gap-2">
                <Sliders size={16} /> 1. Previous Ring (Before Ring)
              </h3>
              <span className="text-xs text-text-muted font-mono">Input Parameters</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label>Planning Ring No.</label>
                <input
                  type="text"
                  value={ringNum}
                  onChange={(e) => setRingNum(e.target.value)}
                  className="font-mono font-bold text-acc"
                  placeholder="e.g. R0016"
                />
              </div>

              <div className="field">
                <label>Before Ring Key</label>
                <select
                  value={beforeKey}
                  onChange={(e) => {
                    const k = e.target.value;
                    setBeforeKey(k);
                    setSelectedCandidateKey(null);
                  }}
                  className="font-mono font-bold text-text"
                >
                  {Object.keys(KEY_DATA).map((k) => (
                    <option key={k} value={k}>
                      {k} ({KEY_DATA[k].type === 'R' ? 'Right' : KEY_DATA[k].type === 'L' ? 'Left' : 'Univ'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label>Before Ring H Lead (mm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={beforeHLead}
                  onChange={(e) => setBeforeHLead(e.target.value)}
                  className="font-mono text-text"
                />
              </div>

              <div className="field">
                <label>Before Ring V Lead (mm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={beforeVLead}
                  onChange={(e) => setBeforeVLead(e.target.value)}
                  className="font-mono text-text"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label>Segment Width (L)</label>
                <div className="flex gap-2">
                  {[1400, 1200].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setSegWidth(w)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                        segWidth === w
                          ? 'bg-acc/15 border-acc text-acc'
                          : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
                      }`}
                    >
                      {w} mm
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Ring Roll Angle (°)</label>
                <input
                  type="number"
                  step="0.1"
                  value={rollDeg}
                  onChange={(e) => setRollDeg(e.target.value)}
                  className="font-mono text-text"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Curve Offset & Alignment */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <Compass size={16} /> 2. Curve Alignment & Design Offset
              </h3>
              <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomCurve}
                  onChange={(e) => setUseCustomCurve(e.target.checked)}
                  className="rounded bg-surf-3 border-white/20"
                />
                Custom Offset
              </label>
            </div>

            {!useCustomCurve ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label>Curve Radius (R in m)</label>
                    <select
                      value={curveRadius}
                      onChange={(e) => setCurveRadius(Number(e.target.value))}
                      className="font-mono text-xs text-text"
                    >
                      <option value={0}>Straight Line (R = ∞)</option>
                      <option value={1000}>R = 1,000 m</option>
                      <option value={500}>R = 500 m</option>
                      <option value={300}>R = 300 m</option>
                      <option value={200}>R = 200 m</option>
                      <option value={160}>R = 160 m (Sharp)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Curve Direction</label>
                    <div className="flex gap-2">
                      {['R', 'L'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCurveDir(d)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                            curveDir === d
                              ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                              : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
                          }`}
                        >
                          {d === 'R' ? 'Right Curve' : 'Left Curve'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Computed Curve values display */}
                <div className="bg-surf-3 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs border border-white/5 font-mono">
                  <div>
                    <span className="text-xs text-text-muted block">Curve H Lead</span>
                    <span className="font-bold text-acc">{computedCurve.hLead > 0 ? `+${computedCurve.hLead}` : computedCurve.hLead} mm</span>
                  </div>
                  <div>
                    <span className="text-xs text-text-muted block">Curve V Lead</span>
                    <span className="font-bold text-acc">{computedCurve.vLead > 0 ? `+${computedCurve.vLead}` : computedCurve.vLead} mm</span>
                  </div>
                  <div>
                    <span className="text-xs text-text-muted block">Articulation</span>
                    <span className="font-bold text-fair">{computedCurve.articulation}°</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Custom Curve H (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customCurveH}
                    onChange={(e) => setCustomCurveH(e.target.value)}
                    className="font-mono text-text"
                  />
                </div>
                <div className="field">
                  <label>Custom Curve V (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customCurveV}
                    onChange={(e) => setCustomCurveV(e.target.value)}
                    className="font-mono text-text"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Gap & Tail Clearance Input */}
          <GapVisualizer
            gapT={gapT}
            gapB={gapB}
            gapL={gapL}
            gapR={gapR}
            editable={true}
            onChange={(field, val) => {
              if (field === 'gapT') setGapT(val);
              if (field === 'gapB') setGapB(val);
              if (field === 'gapL') setGapL(val);
              if (field === 'gapR') setGapR(val);
            }}
          />
        </div>

        {/* Right Column: Interactive Ring & Candidate Key Recommendation (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Main Visualizer Card */}
          <div className="card grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0 md:pr-4">
              <RingDiagram
                selectedKey={activeKey}
                beforeKey={beforeKey}
                hoveredKey={hoveredCandidateKey}
                rollDeg={rollDeg}
                size={270}
                interactive={true}
                onSelectKey={(k) => setSelectedCandidateKey(k)}
              />
            </div>

            <div className="md:col-span-6 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-text-muted">Recommended Selection</span>
                  <KeySuitabilityBadge suitability={activeCandidateData?.suitability} size="sm" />
                </div>
                <h3 className="text-3xl font-black font-mono text-acc flex items-center gap-3">
                  {activeKey}
                  <span className="text-xs font-normal px-2 py-0.5 rounded bg-white/10 text-text font-sans">
                    {activeCandidateData?.type === 'R' ? 'Right Taper' : activeCandidateData?.type === 'L' ? 'Left Taper' : 'Universal'}
                  </span>
                </h3>
              </div>

              {/* Lead Before vs After comparison */}
              <div className="space-y-2 bg-surf-3/80 rounded-xl p-3.5 border border-white/10 text-xs font-mono">
                <div className="flex justify-between items-center text-text-muted pb-1.5 border-b border-white/5">
                  <span>Candidate Segment Lead:</span>
                  <span className="text-text font-semibold">
                    H: {activeCandidateData?.segHLead} | V: {activeCandidateData?.segVLead} mm
                  </span>
                </div>
                <div className="flex justify-between items-center text-text-muted pb-1.5 border-b border-white/5">
                  <span>Curve Offset Applied:</span>
                  <span className="text-text font-semibold">
                    H: {computedCurve.hLead} | V: {computedCurve.vLead} mm
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-text">Predicted After-Ring Lead:</span>
                  <span className="text-sm font-bold text-emerald-400">
                    H: {activeCandidateData?.afterHLead > 0 ? `+${activeCandidateData?.afterHLead}` : activeCandidateData?.afterHLead} | V: {activeCandidateData?.afterVLead > 0 ? `+${activeCandidateData?.afterVLead}` : activeCandidateData?.afterVLead} mm
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <div className="field">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Shift Notes / Observation (optional)"
                    className="text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  className="w-full btn btn-yes py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                >
                  <Save size={18} />
                  Confirm & Save Ring #{ringNum} ({activeKey})
                </button>
              </div>
            </div>
          </div>

          {/* Candidate Next Keys Table & Quick Selection */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-acc" /> All Compatible Candidate Keys ({candidates.length})
                </h3>
                <p className="text-xs text-text-muted">Ranked by bolt suitability & minimal lead drift</p>
              </div>
              <span className="text-xs font-mono text-text-muted">Click row to preview & select</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-text-muted bg-surf-3/50 font-mono">
                    <th className="p-2.5">Key</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Suitability</th>
                    <th className="p-2.5">Segment Lead (H/V)</th>
                    <th className="p-2.5">After Ring H</th>
                    <th className="p-2.5">After Ring V</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {candidates.map((cand) => {
                    const isSelected = activeKey === cand.key;
                    return (
                      <tr
                        key={cand.key}
                        onClick={() => setSelectedCandidateKey(cand.key)}
                        onMouseEnter={() => setHoveredCandidateKey(cand.key)}
                        onMouseLeave={() => setHoveredCandidateKey(null)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-acc/10 text-white font-bold'
                            : 'hover:bg-white/5 text-text-muted hover:text-text'
                        }`}
                      >
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            cand.type === 'R' ? 'bg-rose-500/20 text-rose-400' : cand.type === 'L' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {cand.key}
                          </span>
                        </td>
                        <td className="p-2.5 text-xs font-sans">
                          {cand.type === 'R' ? 'Right' : cand.type === 'L' ? 'Left' : 'Univ'}
                        </td>
                        <td className="p-2.5">
                          <KeySuitabilityBadge suitability={cand.suitability} size="sm" />
                        </td>
                        <td className="p-2.5">
                          {cand.segHLead} / {cand.segVLead}
                        </td>
                        <td className={`p-2.5 font-bold ${cand.afterHLead === 0 ? 'text-emerald-400' : 'text-text'}`}>
                          {cand.afterHLead > 0 ? `+${cand.afterHLead}` : cand.afterHLead} mm
                        </td>
                        <td className={`p-2.5 font-bold ${cand.afterVLead === 0 ? 'text-emerald-400' : 'text-text'}`}>
                          {cand.afterVLead > 0 ? `+${cand.afterVLead}` : cand.afterVLead} mm
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCandidateKey(cand.key);
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-sans font-semibold transition-all ${
                              isSelected
                                ? 'bg-acc text-black shadow-md shadow-cyan-500/30'
                                : 'bg-white/10 hover:bg-white/20 text-text'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

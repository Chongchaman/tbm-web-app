import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Compass, 
  Sliders, 
  Play, 
  Download, 
  Check, 
  Layers, 
  TrendingUp, 
  AlertCircle, 
  ArrowRight, 
  CornerDownRight, 
  CornerDownLeft, 
  MoveRight,
  Database,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import KeySuitabilityBadge from '../components/KeySuitabilityBadge';
import { runAutoPlan, calculateLeadRequest } from '../services/autoPlanner';
import { KEY_DATA } from '../data/tbmConstants';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function AutoPlannerView({ ringLogs = [], onBatchSave = () => {} }) {
  // Default from latest log
  const lastRing = ringLogs.length > 0 ? ringLogs[ringLogs.length - 1] : null;
  const defaultStartRing = lastRing
    ? `R${String(parseInt(lastRing.ringNum.replace(/\D/g, '') || '0') + 1).padStart(4, '0')}`
    : 'R0016';

  // Input states
  const [startRingNum, setStartRingNum] = useState(defaultStartRing);
  const [startKey, setStartKey] = useState(lastRing ? lastRing.key : 'L2');
  const [startHLead, setStartHLead] = useState(lastRing ? lastRing.hLead : 38.39);
  const [startVLead, setStartVLead] = useState(lastRing ? lastRing.vLead : 32.47);

  // Alignment states
  const [alignmentType, setAlignmentType] = useState('right'); // 'straight' | 'right' | 'left'
  const [radius, setRadius] = useState(500);
  const [segWidth, setSegWidth] = useState(1400);
  const [ringCount, setRingCount] = useState(10);
  const [targetV, setTargetV] = useState(0);

  // Status states
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Real-time Lead Request calculation
  const liveLeadRequest = useMemo(() => {
    return calculateLeadRequest({ alignmentType, radius, segWidth });
  }, [alignmentType, radius, segWidth]);

  // Run Simulation automatically on input change or on trigger
  const planResult = useMemo(() => {
    return runAutoPlan({
      startRingNum,
      startKey,
      startHLead: Number(startHLead) || 0,
      startVLead: Number(startVLead) || 0,
      alignmentType,
      radius: Number(radius) || 500,
      segWidth: Number(segWidth) || 1400,
      ringCount: Number(ringCount) || 10,
      targetV: Number(targetV) || 0,
    });
  }, [startRingNum, startKey, startHLead, startVLead, alignmentType, radius, segWidth, ringCount, targetV]);

  // Trajectory Simulation Chart Data
  const chartData = useMemo(() => {
    const labels = planResult.plannedRings.map((r) => r.ringNum);
    const hData = planResult.plannedRings.map((r) => r.afterH);
    const vData = planResult.plannedRings.map((r) => r.afterV);
    const targetHLine = planResult.plannedRings.map(() => planResult.leadRequest);

    return {
      labels,
      datasets: [
        {
          label: 'Planned H Lead (mm)',
          data: hData,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: '#00d4ff',
        },
        {
          label: `Target Lead Request (${planResult.leadRequest > 0 ? '+' : ''}${planResult.leadRequest} mm)`,
          data: targetHLine,
          borderColor: '#ffab40',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Planned V Lead (mm)',
          data: vData,
          borderColor: '#ff5252',
          backgroundColor: 'rgba(255, 82, 82, 0.1)',
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: '#ff5252',
        },
      ],
    };
  }, [planResult]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e8eaf6', font: { family: 'JetBrains Mono', size: 11 } },
      },
      tooltip: {
        backgroundColor: '#111827',
        titleColor: '#00d4ff',
        bodyColor: '#e8eaf6',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: '#8a94a6', font: { size: 10, family: 'JetBrains Mono' } },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        ticks: { color: '#8a94a6', font: { size: 10, family: 'JetBrains Mono' } },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };

  // Batch Apply handler
  const handleBatchApply = () => {
    if (window.confirm(`Confirm batch saving all ${planResult.plannedRings.length} auto-planned rings into Ring Log history?`)) {
      const formattedForLog = planResult.plannedRings.map((r, i) => ({
        ringNum: r.ringNum,
        key: r.selectedKey,
        hLead: r.afterH,
        vLead: r.afterV,
        gapT: r.gapT,
        gapB: r.gapB,
        gapL: r.gapL,
        gapR: r.gapR,
        roll: 0,
        pitch: 0,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        notes: r.notes,
      }));

      onBatchSave(formattedForLog);
      setAppliedSuccess(true);
      setTimeout(() => setAppliedSuccess(false), 3500);
    }
  };

  // Export Plan to CSV
  const handleExportPlanCSV = () => {
    const headers = [
      'Step',
      'Ring No.',
      'Previous Key',
      'Selected Key',
      'Type',
      'Segment H Lead (mm)',
      'Segment V Lead (mm)',
      'After Ring H (mm)',
      'After Ring V (mm)',
      'Target Lead Request (mm)',
      'Drift Error (mm)',
      'Suitability',
    ];

    const rows = planResult.plannedRings.map((r) => [
      r.step,
      r.ringNum,
      r.prevKey,
      r.selectedKey,
      r.type,
      r.segHLead,
      r.segVLead,
      r.afterH,
      r.afterV,
      r.targetH,
      r.totalDrift,
      r.suitability,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tbm_autoplan_${planResult.alignmentType}_${planResult.ringCount}rings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surf-2 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-acc/15 text-acc border border-acc/30 flex items-center gap-1">
              <Sparkles size={13} /> AUTO SEQUENCING AI
            </span>
            <span className="text-xs text-text-muted">MWA-9D TBM#34 Automated Planning</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">Multi-Ring Auto Plan Simulation</h2>
          <p className="text-sm text-text-muted mt-1">
            Automated segment selection across multiple consecutive rings based on alignment curve and Lead Request formula.
          </p>
        </div>

        {appliedSuccess && (
          <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-xl text-sm font-medium animate-bounce">
            <CheckCircle2 size={18} />
            <span>{planResult.plannedRings.length} Rings Added to History Log!</span>
          </div>
        )}
      </div>

      {/* Inputs and Formula Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Condition Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Initial State */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-acc uppercase tracking-wider flex items-center gap-2">
                <Sliders size={16} /> 1. Previous Ring Baseline
              </h3>
              <span className="text-xs text-text-muted font-mono">Starting State</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>Starting Ring No.</label>
                <input
                  type="text"
                  value={startRingNum}
                  onChange={(e) => setStartRingNum(e.target.value)}
                  className="font-mono font-bold text-acc"
                />
              </div>

              <div className="field">
                <label>Previous Key</label>
                <select
                  value={startKey}
                  onChange={(e) => setStartKey(e.target.value)}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label>Initial H Lead (mm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={startHLead}
                  onChange={(e) => setStartHLead(e.target.value)}
                  className="font-mono text-text"
                />
              </div>

              <div className="field">
                <label>Initial V Lead (mm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={startVLead}
                  onChange={(e) => setStartVLead(e.target.value)}
                  className="font-mono text-text"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Alignment Conditions */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <Compass size={16} /> 2. Alignment & Curve Conditions
              </h3>
              <span className="text-xs text-text-muted font-mono">Direction</span>
            </div>

            {/* Alignment Buttons */}
            <div className="field">
              <label>Alignment Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAlignmentType('straight')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    alignmentType === 'straight'
                      ? 'bg-acc/15 border-acc text-acc shadow-md shadow-cyan-500/20'
                      : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
                  }`}
                >
                  <MoveRight size={16} />
                  <span>ทางตรง (Straight)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAlignmentType('right')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    alignmentType === 'right'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20'
                      : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
                  }`}
                >
                  <CornerDownRight size={16} />
                  <span>เลี้ยวขวา (+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAlignmentType('left')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    alignmentType === 'left'
                      ? 'bg-rose-500/20 border-rose-400 text-rose-300 shadow-md shadow-rose-500/20'
                      : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
                  }`}
                >
                  <CornerDownLeft size={16} />
                  <span>เลี้ยวซ้าย (-)</span>
                </button>
              </div>
            </div>

            {/* Curve Radius & Segment Specs */}
            {alignmentType !== 'straight' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Curve Radius (R in m)</label>
                  <select
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="font-mono text-xs text-text"
                  >
                    <option value={1000}>R = 1,000 m</option>
                    <option value={500}>R = 500 m</option>
                    <option value={300}>R = 300 m</option>
                    <option value={200}>R = 200 m</option>
                    <option value={160}>R = 160 m (Sharp)</option>
                  </select>
                </div>

                <div className="field">
                  <label>Custom Radius (m)</label>
                  <input
                    type="number"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="font-mono text-text text-xs"
                    placeholder="e.g. 500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
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
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-surf-3 border-white/10 text-text-muted hover:border-white/20'
                      }`}
                    >
                      {w} mm
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Rings to Plan (N)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={ringCount}
                  onChange={(e) => setRingCount(Number(e.target.value))}
                  className="font-mono text-text font-bold"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Formula Spec Box */}
          <div className="bg-surf-3/90 border border-white/10 rounded-2xl p-4.5 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-text-muted pb-1.5 border-b border-white/5">
              <span className="font-bold text-text uppercase text-[11px]">📐 Formula: Lead Request Calculation</span>
              <span className="text-[10px] text-acc">Spec Rule #4</span>
            </div>
            <div className="p-2.5 bg-surf-2 rounded-xl text-center space-y-1">
              <div className="text-[11px] text-text-muted">
                Lead request = 6300 &times; L / (R &times; 1000)
              </div>
              <div className="text-sm font-bold text-emerald-400">
                {alignmentType === 'straight' ? (
                  <span>Straight &rarr; <strong>0.00 mm</strong></span>
                ) : alignmentType === 'right' ? (
                  <span>Right (+) &rarr; +6300 &times; {segWidth} / ({radius} &times; 1000) = <strong>+{liveLeadRequest} mm</strong></span>
                ) : (
                  <span>Left (-) &rarr; -6300 &times; {segWidth} / ({radius} &times; 1000) = <strong>{liveLeadRequest} mm</strong></span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Simulation Results & Trajectory (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-3.5">
              <span className="text-[10px] text-text-muted uppercase font-mono">Planned Distance</span>
              <h4 className="text-xl font-extrabold font-mono text-acc mt-0.5">{planResult.totalDistanceM} <span className="text-xs font-normal text-text-muted">m</span></h4>
              <span className="text-[10px] text-text-muted">{planResult.ringCount} Rings &times; {segWidth}mm</span>
            </div>

            <div className="card p-3.5">
              <span className="text-[10px] text-text-muted uppercase font-mono">Target Lead Req.</span>
              <h4 className="text-xl font-extrabold font-mono text-emerald-400 mt-0.5">
                {planResult.leadRequest > 0 ? `+${planResult.leadRequest}` : planResult.leadRequest} <span className="text-xs font-normal text-text-muted">mm</span>
              </h4>
              <span className="text-[10px] text-text-muted">{alignmentType.toUpperCase()} Alignment</span>
            </div>

            <div className="card p-3.5">
              <span className="text-[10px] text-text-muted uppercase font-mono">Max Drift Error</span>
              <h4 className="text-xl font-extrabold font-mono text-amber-400 mt-0.5">{planResult.maxDrift} <span className="text-xs font-normal text-text-muted">mm</span></h4>
              <span className="text-[10px] text-text-muted">Avg: {planResult.avgDrift} mm</span>
            </div>

            <div className="card p-3.5">
              <span className="text-[10px] text-text-muted uppercase font-mono">Key Mix</span>
              <div className="flex gap-2 mt-1 font-mono text-xs">
                <span className="text-rose-400 font-bold">R:{planResult.rCount}</span>
                <span className="text-cyan-400 font-bold">L:{planResult.lCount}</span>
                <span className="text-amber-400 font-bold">U:{planResult.uCount}</span>
              </div>
              <span className="text-[10px] text-text-muted">Cross-type loop</span>
            </div>
          </div>

          {/* Trajectory Simulation Chart */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={16} className="text-acc" /> Simulated Trajectory vs Target Lead Request
                </h3>
                <p className="text-xs text-text-muted">Demonstrates multi-ring convergence toward design lead</p>
              </div>
            </div>

            <div className="h-[250px] w-full pt-1">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surf-2 border border-white/10 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
              <Sparkles size={16} className="text-acc" />
              <span>Ready: <strong>{planResult.plannedRings.length} rings</strong> generated with optimal Suitability scores.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPlanCSV}
                className="btn btn-outline py-2 text-xs font-semibold flex items-center gap-1.5 hover:border-acc"
              >
                <Download size={15} /> Export Plan (CSV)
              </button>

              <button
                type="button"
                onClick={handleBatchApply}
                className="btn btn-yes py-2 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
              >
                <Database size={15} /> Batch Apply to Log
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Table: Sequence Breakdown */}
      <div className="card space-y-4 p-0 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-surf-3/40">
          <div>
            <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-acc" /> Auto Plan Sequence Breakdown (Step 1 to {planResult.plannedRings.length})
            </h3>
            <p className="text-xs text-text-muted">Step-by-step key progression, resulting leads, and tolerance verification</p>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold">100% Validated Connections</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-white/10 text-text-muted bg-surf-3/80">
                <th className="p-3">Step</th>
                <th className="p-3">Ring No.</th>
                <th className="p-3">Prev Key</th>
                <th className="p-3">Auto Key</th>
                <th className="p-3">Type</th>
                <th className="p-3">Suitability</th>
                <th className="p-3">Seg Lead (H/V)</th>
                <th className="p-3">After Ring H</th>
                <th className="p-3">After Ring V</th>
                <th className="p-3">Target Req.</th>
                <th className="p-3">Drift Error</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {planResult.plannedRings.map((r) => (
                <tr key={r.step} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 text-text-muted font-bold">#{r.step}</td>
                  <td className="p-3 font-bold text-acc">{r.ringNum}</td>
                  <td className="p-3 text-text-muted">{r.prevKey}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded font-black text-sm shadow-sm ${
                      r.type === 'R' ? 'bg-rose-500/20 text-rose-400' : r.type === 'L' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {r.selectedKey}
                    </span>
                  </td>
                  <td className="p-3 text-[11px] font-sans">
                    {r.type === 'R' ? 'Right' : r.type === 'L' ? 'Left' : 'Univ'}
                  </td>
                  <td className="p-3">
                    <KeySuitabilityBadge suitability={r.suitability} size="sm" />
                  </td>
                  <td className="p-3 text-text-muted">
                    {r.segHLead} / {r.segVLead}
                  </td>
                  <td className={`p-3 font-bold ${r.afterH === r.targetH ? 'text-emerald-400' : 'text-text'}`}>
                    {r.afterH > 0 ? `+${r.afterH}` : r.afterH} mm
                  </td>
                  <td className="p-3 font-semibold text-text">
                    {r.afterV > 0 ? `+${r.afterV}` : r.afterV} mm
                  </td>
                  <td className="p-3 text-fair font-bold">
                    {r.targetH > 0 ? `+${r.targetH}` : r.targetH} mm
                  </td>
                  <td className={`p-3 font-bold ${r.totalDrift <= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {r.totalDrift} mm
                  </td>
                  <td className="p-3 text-[11px] text-text-muted truncate max-w-[180px]">
                    {r.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  Sparkles, 
  Layers, 
  Sliders, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Database, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowRight, 
  Check, 
  ShieldAlert, 
  Percent,
  SlidersHorizontal,
  Info,
  Play,
  RotateCcw,
  Eye,
  MapPin,
  Maximize2,
  Save,
  Lock,
  Unlock,
  Boxes,
  Lightbulb,
  Activity,
  Gauge,
  Zap
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
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import KeySuitabilityBadge from '../components/KeySuitabilityBadge';
import GapVisualizer from '../components/GapVisualizer';
import Tunnel2DVisualizer from '../components/Tunnel2DVisualizer';
import { 
  DEFAULT_ALIGNMENT_SECTIONS, 
  DEFAULT_VERTICAL_ALIGNMENT, 
  RATIO_PRESETS,
  runAdvancePlan, 
  computeRatioBreakdown,
  estimateRingCount,
  createNewSection,
  findBestRatioForSection,
  DEFAULT_GAP_SETTINGS,
  formatSTA, 
  parseSTA,
  SEGMENT_SIZES 
} from '../services/advancePlanner';
import { KEY_DATA } from '../data/tbmConstants';
import { getAIConfidenceLevel } from '../services/aiCalibrator';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdvancePlannerView({ ringLogs = [], onBatchSave = () => {}, onNavigate = () => {} }) {
  const lastRing = ringLogs.length > 0 ? ringLogs[ringLogs.length - 1] : null;

  // Sections State (Dynamic CRUD & LocalStorage sync with safe fallback)
  const [sections, setSections] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_horizontal_alignment');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_ALIGNMENT_SECTIONS;
  });

  const [vProfile, setVProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_vertical_alignment');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_VERTICAL_ALIGNMENT;
  });

  // Strategy Mode: 'senior_ai' (Free Ratio + Gap Safe) | 'auto_ratio' | 'ratio_guided'
  const [strategy, setStrategy] = useState('senior_ai');

  // Tail Gap Configuration
  const [gapSettings, setGapSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_gap_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.warnThreshold === 'number') return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_GAP_SETTINGS;
  });

  const [isGapDrawerOpen, setIsGapDrawerOpen] = useState(false);
  const [isSectionConfigExpanded, setIsSectionConfigExpanded] = useState(false);

  const [startKey, setStartKey] = useState(lastRing ? lastRing.key : 'U4');
  const [startHLead, setStartHLead] = useState(lastRing ? lastRing.hLead : 0);
  const [startVLead, setStartVLead] = useState(lastRing ? lastRing.vLead : 0);
  const [maxTolerance, setMaxTolerance] = useState(55.0);
  const [steeringSign, setSteeringSign] = useState('steering_bias'); // 'steering_bias' (Right = -)
  const [activeSubTab, setActiveSubTab] = useState('2d_map'); // '2d_map' | 'trajectory_chart' | 'table'

  // Explicit Calculation Trigger State
  const [isCalculated, setIsCalculated] = useState(true);
  const [needsRecalc, setNeedsRecalc] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Active Simulation Step Index for 2D Map Scrubber
  const [scrubStep, setScrubStep] = useState(1);

  // Plan Calculation State (Safe initialization)
  const [planResult, setPlanResult] = useState(() => {
    try {
      return runAdvancePlan({
        sections: DEFAULT_ALIGNMENT_SECTIONS,
        verticalAlignment: DEFAULT_VERTICAL_ALIGNMENT,
        startKey: 'U4',
        startHLead: -20,
        startVLead: -10,
        maxTolerance: 55.0,
        steeringSign: 'steering_bias',
      });
    } catch (e) {
      console.error('Initial plan error:', e);
      return {
        sections: DEFAULT_ALIGNMENT_SECTIONS,
        totalRings: 0,
        counts: { un: 0, rt: 0, lt: 0 },
        plannedRings: [],
        violations: [],
        maxObservedLead: 0,
        maxDeviationMm: 0,
        verdict: { status: 'OPTIMAL', message: 'พร้อมสำหรับการคำนวณ', advice: [] },
      };
    }
  });

  // Calculate Action Handler
  const handleCalculate = () => {
    const res = runAdvancePlan({
      sections,
      verticalAlignment: vProfile,
      startKey,
      startHLead: Number(startHLead) || 0,
      startVLead: Number(startVLead) || 0,
      maxTolerance: Number(maxTolerance) || 55.0,
      steeringSign,
      ringLogs, // System 6: Pass ring logs for adaptive calibration
    });
    setPlanResult(res);
    setIsCalculated(true);
    setNeedsRecalc(false);
    setScrubStep(1);
  };

  // Mark state as dirty on changes
  const markDirty = () => {
    setNeedsRecalc(true);
  };

  // Section Ratio Modifier
  const updateSectionRatio = (index, field, value) => {
    setSections((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[index].ratio[field] = Math.max(0, Number(value) || 0);
      return copy;
    });
    markDirty();
  };

  const applyRatioPreset = (index, preset) => {
    setSections((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[index].ratio = { un: preset.un, rt: preset.rt, lt: preset.lt };
      return copy;
    });
    markDirty();
  };

  const handleAutoOptimizeRatio = (index) => {
    const sec = sections[index];
    const bestRatio = findBestRatioForSection(sec, startKey, startHLead, startVLead, maxTolerance);
    
    setSections((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[index].ratio = bestRatio;
      return copy;
    });
    markDirty();
  };

  // Toggle Segment Type (Allow / Forbid)
  const handleToggleAllowedType = (secIdx, typeCode) => {
    setSections((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const currentAllowed = copy[secIdx].allowedTypes || ['U', 'R', 'L'];
      
      let nextAllowed;
      if (currentAllowed.includes(typeCode)) {
        if (currentAllowed.length <= 1) {
          alert('ต้องอนุญาตให้ใช้อย่างน้อย 1 ชนิด Segment');
          return prev;
        }
        nextAllowed = currentAllowed.filter((t) => t !== typeCode);
        if (typeCode === 'U') copy[secIdx].ratio.un = 0;
        if (typeCode === 'R') copy[secIdx].ratio.rt = 0;
        if (typeCode === 'L') copy[secIdx].ratio.lt = 0;
      } else {
        nextAllowed = [...currentAllowed, typeCode];
        if (typeCode === 'U' && copy[secIdx].ratio.un === 0) copy[secIdx].ratio.un = 1;
        if (typeCode === 'R' && copy[secIdx].ratio.rt === 0) copy[secIdx].ratio.rt = 1;
        if (typeCode === 'L' && copy[secIdx].ratio.lt === 0) copy[secIdx].ratio.lt = 1;
      }
      
      copy[secIdx].allowedTypes = nextAllowed;
      return copy;
    });
    markDirty();
  };

  // Sync with Master Settings
  const handleLoadFromSettings = () => {
    try {
      const savedH = localStorage.getItem('tbm_horizontal_alignment');
      const savedV = localStorage.getItem('tbm_vertical_alignment');
      if (savedH) setSections(JSON.parse(savedH));
      if (savedV) setVProfile(JSON.parse(savedV));
      markDirty();
      alert('โหลดแนว Alignment จาก Master Settings เรียบร้อยแล้ว! กรุณากด "⚡ คำนวณการวางแผน" เพื่ออัปเดตผล');
    } catch (e) {
      alert('Error loading alignment: ' + e.message);
    }
  };

  const handleSaveToSettings = () => {
    try {
      localStorage.setItem('tbm_horizontal_alignment', JSON.stringify(sections));
      alert('บันทึกแนว Alignment ปัจจุบันไปยัง Master Settings เรียบร้อยแล้ว!');
    } catch (e) {
      alert('Error saving alignment: ' + e.message);
    }
  };

  // Add Section Handler
  const handleAddSection = () => {
    const newSec = createNewSection('full_curve', 'right', 180);
    setSections((prev) => [...prev, newSec]);
    markDirty();
  };

  // Delete Section Handler
  const handleDeleteSection = (index) => {
    if (sections.length <= 1) {
      alert('Must have at least 1 alignment section.');
      return;
    }
    if (window.confirm(`Delete Section ${sections[index].code}?`)) {
      setSections((prev) => prev.filter((_, i) => i !== index));
      markDirty();
    }
  };

  // Reset to Drawing Defaults
  const handleResetSections = () => {
    if (window.confirm('Reset all alignment sections to Project Drawing default (12", 13, 13A)?')) {
      setSections(DEFAULT_ALIGNMENT_SECTIONS);
      markDirty();
    }
  };

  // Trajectory Chart Data
  const chartData = useMemo(() => {
    const labels = planResult.plannedRings.map((r) => `${r.ringNum} (${r.sta})`);
    const hData = planResult.plannedRings.map((r) => r.afterH);
    const vData = planResult.plannedRings.map((r) => r.afterV);
    const reqData = planResult.plannedRings.map((r) => r.leadReq);
    const topLimit = planResult.plannedRings.map(() => planResult.maxTolerance);
    const botLimit = planResult.plannedRings.map(() => -planResult.maxTolerance);

    return {
      labels,
      datasets: [
        {
          label: 'Predicted H Lead (mm)',
          data: hData,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          tension: 0.2,
          pointRadius: 2.5,
          pointBackgroundColor: '#00d4ff',
        },
        {
          label: 'Steering Lead Required (mm)',
          data: reqData,
          borderColor: '#ffab40',
          borderDash: [5, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Predicted V Lead (mm)',
          data: vData,
          borderColor: '#a855f7',
          borderWidth: 1.5,
          pointRadius: 1.5,
          pointBackgroundColor: '#a855f7',
        },
        {
          label: `+${planResult.maxTolerance}mm Limit`,
          data: topLimit,
          borderColor: 'rgba(255, 82, 82, 0.4)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
        },
        {
          label: `-${planResult.maxTolerance}mm Limit`,
          data: botLimit,
          borderColor: 'rgba(255, 82, 82, 0.4)',
          borderDash: [3, 3],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
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
        labels: { color: '#e8eaf6', font: { family: 'JetBrains Mono', size: 10 } },
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
        ticks: { color: '#8a94a6', font: { size: 9, family: 'JetBrains Mono' }, maxTicksLimit: 12 },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        ticks: { color: '#8a94a6', font: { size: 10, family: 'JetBrains Mono' } },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };

  // Batch Save
  const handleBatchSave = () => {
    if (!isCalculated || needsRecalc) {
      alert('Please click "Calculate / Simulate Plan" first before saving.');
      return;
    }

    if (window.confirm(`Confirm batch saving all ${planResult.plannedRings.length} rings from Advance STA Plan into Ring Log history?`)) {
      const records = planResult.plannedRings.map((r) => ({
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

      onBatchSave(records);
      setAppliedSuccess(true);
      setTimeout(() => setAppliedSuccess(false), 3500);
    }
  };

  // Export Plan to CSV
  const handleExportCSV = () => {
    const headers = [
      'Step',
      'STA (Chainage)',
      'Ring No.',
      'Section',
      'Segment Type',
      'Segment Size (m)',
      'Previous Key',
      'Planned Key',
      'Segment H Lead',
      'Segment V Lead',
      'Steering Lead Req (mm)',
      'After Ring H (mm)',
      'After Ring V (mm)',
      'DTA Deviation (mm)',
      'Suitability',
      'Tail Gap Min (mm)',
      'Gap Left (mm)',
      'Gap Right (mm)',
      'Gap Top (mm)',
      'Gap Bottom (mm)',
      'Risk Score (0-100)',
      'Articulation (deg)',
      'AI Reasoning',
      'Limit Status',
    ];

    const rows = planResult.plannedRings.map((r) => [
      r.step,
      r.sta,
      r.ringNum,
      r.sectionCode,
      r.type === 'U' ? 'UN (1.2m)' : r.type === 'R' ? 'RT (1.4m)' : 'LT (1.4m)',
      r.sizeM,
      r.prevKey,
      r.selectedKey,
      r.segHLead,
      r.segVLead,
      r.leadReq,
      r.afterH,
      r.afterV,
      r.deviationMm,
      r.suitability,
      r.minGap,
      r.gapL,
      r.gapR,
      r.gapT,
      r.gapB,
      r.riskIndex,
      r.articulationDeg,
      `"${(r.aiReasoning || '').replace(/"/g, '""')}"`,
      r.exceedsLimit ? `EXCEEDED by +${r.overLimitAmount}mm` : 'OK (<=55mm)',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tbm_advance_plan_STA_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const verdict = planResult.verdict;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surf-2 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
              <Compass size={13} /> ADVANCE ALIGNMENT & 2D TRAJECTORY
            </span>
            <span className="text-xs text-text-muted">Dynamic Alignment &bull; Curve Steering &bull; 2D Visual Map</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">Station (STA.) Alignment & 2D Simulator</h2>
          <p className="text-sm text-text-muted mt-1">
            จัดการช่วง Alignment เพิ่ม/ลบได้อิสระ &bull; เลี้ยง Lead ติดลบในโค้งขวาเพื่อเลี้ยวเข้าโค้ง &bull; จำลองแผนที่ 2 มิติเทียบกับแนว DTA
          </p>
        </div>

        {/* Big Action Button Bar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCalculate}
            className={`btn px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
              needsRecalc
                ? 'bg-amber-400 text-black shadow-amber-400/30 animate-pulse'
                : 'bg-acc text-black shadow-cyan-400/25 hover:bg-cyan-300'
            }`}
          >
            <Play size={16} />
            <span>{needsRecalc ? '⚡ กดคำนวณใหม่ (Calculate)' : '⚡ คำนวณการวางแผน (Calculate)'}</span>
          </button>

          <button
            type="button"
            onClick={handleBatchSave}
            disabled={needsRecalc || !isCalculated}
            className={`btn py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              needsRecalc || !isCalculated
                ? 'bg-surf-3 text-text-muted border border-white/5 cursor-not-allowed opacity-50'
                : 'btn-yes shadow-lg shadow-emerald-900/30'
            }`}
          >
            <Database size={15} />
            <span>บันทึกเข้าระบบ ({planResult.plannedRings.length} ริง)</span>
          </button>
        </div>
      </div>

      {appliedSuccess && (
        <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-sm font-medium">
          <CheckCircle2 size={18} />
          <span>บันทึกข้อมูล {planResult.plannedRings.length} ริง เข้าสู่ประวัติ Ring Log เรียบร้อยแล้ว!</span>
        </div>
      )}

      {/* Feasibility Evaluator Verdict Banner */}
      <div
        className={`border rounded-2xl p-5 shadow-lg transition-all ${
          verdict.status === 'OPTIMAL'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : verdict.status === 'WARNING'
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-rose-500/10 border-rose-500/30'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                verdict.status === 'OPTIMAL'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : verdict.status === 'WARNING'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {verdict.status === 'OPTIMAL' ? (
                <CheckCircle2 size={24} />
              ) : verdict.status === 'WARNING' ? (
                <AlertTriangle size={24} />
              ) : (
                <ShieldAlert size={24} />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-muted">
                  Ratio & Steering Feasibility
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    verdict.status === 'OPTIMAL'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : verdict.status === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {verdict.status === 'OPTIMAL' ? '🟢 ใช้งานได้สมบูรณ์ (ไม่แหกโค้ง)' : verdict.status === 'WARNING' ? '🟡 มีคำเตือนบางจุด' : '🔴 อัตราส่วนนี้ไม่เหมาะสม'}
                </span>
              </div>
              <h4 className="text-base font-bold text-text">{verdict.message}</h4>
              {verdict.advice.map((adv, idx) => (
                <p key={idx} className="text-xs text-text-muted flex items-center gap-1.5 pt-0.5">
                  <ArrowRight size={13} className="text-acc shrink-0" />
                  <span>{adv}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-surf-3/80 px-4 py-2.5 rounded-xl border border-white/10 shrink-0 font-mono text-xs">
            <div>
              <span className="text-[10px] text-text-muted uppercase block">Max Lead Seen</span>
              <span
                className={`text-lg font-bold ${
                  planResult.maxObservedLead <= planResult.maxTolerance
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {planResult.maxObservedLead} mm
              </span>
            </div>
            <div className="border-l border-white/10 pl-3">
              <span className="text-[10px] text-text-muted uppercase block">Max DTA Dev</span>
              <span className="text-lg font-bold text-cyan-400">{planResult.maxDeviationMm} mm</span>
            </div>
            <div className="border-l border-white/10 pl-3">
              <span className="text-[10px] text-text-muted uppercase block">Avg Risk Index</span>
              <span
                className={`text-lg font-bold ${
                  (planResult.avgRiskIndex || 0) <= 25
                    ? 'text-emerald-400'
                    : (planResult.avgRiskIndex || 0) <= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {planResult.avgRiskIndex || 0}<span className="text-xs text-text-muted">/100</span>
              </span>
            </div>
            <div className="border-l border-white/10 pl-3">
              <span className="text-[10px] text-text-muted uppercase block">Max Artic Angle</span>
              <span className="text-lg font-bold text-purple-400">{planResult.maxArticulationDeg || 0}&deg;</span>
            </div>
            <div className="border-l border-white/10 pl-3">
              <span className="text-[10px] text-text-muted uppercase block">Violations (&gt;55mm)</span>
              <span
                className={`text-lg font-bold ${
                  planResult.violationCount === 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {planResult.violationCount} ริง
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Running Ratio Summary */}
      {isCalculated && planResult.totalRings > 0 && (
        <div className="flex flex-wrap items-center gap-4 bg-surf-2 border border-white/10 rounded-2xl px-5 py-3 font-mono text-xs">
          <span className="text-text-muted font-sans font-semibold">ผลลัพธ์จริง:</span>
          <span className="text-text font-bold">{planResult.totalRings} ริง</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">UN: {planResult.counts.un} ({(planResult.counts.un / planResult.totalRings * 100).toFixed(1)}%)</span>
          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-bold">RT: {planResult.counts.rt} ({(planResult.counts.rt / planResult.totalRings * 100).toFixed(1)}%)</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold">LT: {planResult.counts.lt} ({(planResult.counts.lt / planResult.totalRings * 100).toFixed(1)}%)</span>
        </div>
      )}

      {/* Global Parameters & Steering Convention Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surf-2 border border-white/10 rounded-2xl p-4 shadow-md font-mono text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-text-muted font-sans font-semibold">1. Starting Key:</span>
            <select
              value={startKey}
              onChange={(e) => { setStartKey(e.target.value); markDirty(); }}
              className="bg-surf-3 border border-white/15 px-3 py-1.5 rounded-lg font-bold text-acc outline-none cursor-pointer"
            >
              {Object.keys(KEY_DATA).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted font-sans font-semibold">2. Initial H/V Lead:</span>
            <input
              type="number"
              step="0.1"
              value={startHLead}
              onChange={(e) => { setStartHLead(e.target.value); markDirty(); }}
              className="w-16 bg-surf-3 border border-white/15 px-2 py-1.5 rounded-lg text-center font-bold text-text outline-none"
              placeholder="H Lead"
            />
            <input
              type="number"
              step="0.1"
              value={startVLead}
              onChange={(e) => { setStartVLead(e.target.value); markDirty(); }}
              className="w-16 bg-surf-3 border border-white/15 px-2 py-1.5 rounded-lg text-center font-bold text-text outline-none"
              placeholder="V Lead"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-muted font-sans font-semibold">3. Lead Limit:</span>
            <div className="flex items-center gap-1 bg-surf-3 border border-white/15 px-2.5 py-1.5 rounded-lg">
              <span className="text-text-muted">&plusmn;</span>
              <input
                type="number"
                value={maxTolerance}
                onChange={(e) => { setMaxTolerance(Number(e.target.value)); markDirty(); }}
                className="w-12 bg-transparent font-bold text-text outline-none text-center"
              />
              <span className="text-[10px] text-text-muted">mm</span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-white/10 pl-3">
            <span className="text-text-muted font-sans font-semibold">4. Steering Mode:</span>
            <select
              value={steeringSign}
              onChange={(e) => { setSteeringSign(e.target.value); markDirty(); }}
              className="bg-surf-3 border border-white/15 px-2.5 py-1.5 rounded-lg text-xs font-sans text-cyan-300 font-bold outline-none"
            >
              <option value="steering_bias">Active Steering (โค้งขวาเลี้ยงติดลบ ป้องกันแหกโค้ง)</option>
              <option value="standard_positive">Standard Target (Right = +)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetSections}
            className="btn btn-outline py-1.5 px-3 text-xs font-sans flex items-center gap-1.5 text-text-muted hover:text-white"
          >
            <RotateCcw size={13} /> รีเซ็ตช่วงตามแบบ Drawing
          </button>
        </div>
      </div>

      {/* Dynamic Alignment Section Summary & Setting Ratio Switcher */}
      <div className="bg-surf-2 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} className="text-acc" /> ข้อมูลช่วง Alignment ({sections.length} ช่วง)
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {sections.map(s => s.code).join(' → ')}
              </span>
            </div>
            <p className="text-xs text-text-muted">
              สัดส่วน Ratio และการอนุญาตใช้ Segment (UN/RT/LT) ถูกจัดการและบันทึกไว้ในหน้า <strong>Setting Ratio</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => onNavigate('masterdata')}
              className="btn btn-yes py-2 px-3.5 text-xs font-sans font-bold flex items-center gap-1.5 shadow-lg"
            >
              <Sliders size={14} />
              <span>⚙️ ไปที่หน้า Setting Alignment & Ratio</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSectionConfigExpanded(p => !p)}
              className={`btn btn-outline py-2 px-3 text-xs font-sans flex items-center gap-1.5 transition-all ${
                isSectionConfigExpanded ? 'bg-white/10 text-white border-white/30' : 'text-text-muted hover:text-white'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>{isSectionConfigExpanded ? 'ซ่อนการปรับแต่งด่วน' : '📐 ปรับแต่ง Ratio ด่วนในหน้านี้'}</span>
            </button>
          </div>
        </div>

        {/* Compact Alignment Pipeline Chips with Lock Status */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5 font-mono text-xs">
          {sections.map((sec, idx) => (
            <div key={sec.id || idx} className="p-2 bg-surf-3 rounded-xl border border-white/10 flex items-center gap-2">
              <span className="font-bold text-acc">{sec.code}</span>
              <span className="text-[11px] text-text-muted">
                {sec.direction === 'right' ? 'โค้งขวา' : sec.direction === 'left' ? 'โค้งซ้าย' : 'ทางตรง'} (R={sec.radius}m)
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                sec.isLocked !== false
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              }`}>
                {sec.isLocked !== false ? (
                  <>
                    <Lock size={10} /> ล็อคยอด ({sec.ratio ? `${sec.ratio.un}:${sec.ratio.rt}:${sec.ratio.lt}` : '1:1:1'})
                  </>
                ) : (
                  <>
                    <Sparkles size={10} /> AI Auto
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Collapsible Section Cards Grid */}
        {isSectionConfigExpanded && (
          <div className="pt-4 border-t border-white/10 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-acc uppercase font-mono">
                แผงแก้ไขสัดส่วนและข้อจำกัด Segment รายช่วง (Quick Editor):
              </span>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={handleLoadFromSettings}
                  className="btn btn-outline py-1 px-2.5 text-xs text-cyan-300 border-cyan-500/30 flex items-center gap-1"
                >
                  <Download size={13} /> โหลดจาก Settings
                </button>
                <button
                  type="button"
                  onClick={handleSaveToSettings}
                  className="btn btn-outline py-1 px-2.5 text-xs text-emerald-300 border-emerald-500/30 flex items-center gap-1"
                >
                  <Save size={13} /> บันทึกลง Settings
                </button>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="btn btn-outline py-1 px-2.5 text-xs text-purple-300 border-purple-500/30 flex items-center gap-1"
                >
                  <Plus size={13} /> + เพิ่มช่วง
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((sec, idx) => {
            const estRings = estimateRingCount(sec.startSTA, sec.endSTA, sec.ratio);
            const breakdown = computeRatioBreakdown(sec.ratio, estRings || 1);

            return (
              <div key={sec.id} className="card p-4 space-y-3.5 border border-white/10 hover:border-acc/40 transition-all relative group">
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sec.code}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].code = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      className="w-16 px-2 py-0.5 rounded font-mono font-bold text-xs bg-surf-3 border border-white/15 text-acc text-center outline-none"
                    />
                    <input
                      type="text"
                      value={sec.name}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].name = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      className="font-bold text-text text-xs bg-transparent border-b border-transparent focus:border-white/20 outline-none truncate"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(idx)}
                      className="p-1 rounded text-text-muted hover:text-rose-400 hover:bg-white/5 transition-colors"
                      title="Delete Section"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Section Type & Direction Inputs */}
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="field">
                    <label className="text-[9px]">Type</label>
                    <select
                      value={sec.sectionType}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].sectionType = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      className="bg-surf-3 border border-white/10 text-text text-[11px] p-1.5 rounded outline-none"
                    >
                      <option value="full_curve">Full Curve</option>
                      <option value="transition_in">Transition (In)</option>
                      <option value="transition_out">Transition (Out)</option>
                      <option value="tangent">Tangent (ตรง)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="text-[9px]">Direction</label>
                    <select
                      value={sec.direction}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].direction = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      className="bg-surf-3 border border-white/10 text-text text-[11px] p-1.5 rounded outline-none"
                    >
                      <option value="right">Right (ขวา)</option>
                      <option value="left">Left (ซ้าย)</option>
                      <option value="straight">Straight</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="text-[9px]">Radius (m)</label>
                    <input
                      type="number"
                      value={sec.radius}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].radius = Number(e.target.value) || 0;
                        setSections(copy);
                        markDirty();
                      }}
                      className="bg-surf-3 border border-white/10 text-amber-400 font-bold text-[11px] p-1.5 rounded text-center outline-none"
                    />
                  </div>
                </div>

                {/* STA Inputs (Editable) & Estimated Info */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-surf-3/60 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-text-muted text-[10px] block">Start STA</span>
                    <input
                      type="text"
                      value={sec.startSTA}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].startSTA = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      placeholder="20+272.724"
                      className="w-full bg-surf-2 border border-white/10 font-bold text-acc rounded px-1.5 py-1 text-center outline-none focus:border-acc"
                    />
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">End STA</span>
                    <input
                      type="text"
                      value={sec.endSTA}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].endSTA = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      placeholder="20+222.724"
                      className="w-full bg-surf-2 border border-white/10 font-bold text-amber-400 rounded px-1.5 py-1 text-center outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-text-muted px-1">
                  <span>ระยะทาง: <strong className="text-text">{Math.abs(parseSTA(sec.endSTA) - parseSTA(sec.startSTA)).toFixed(1)}m</strong></span>
                  <span>~<strong className="text-text">{estimateRingCount(sec.startSTA, sec.endSTA, sec.ratio)}</strong> ริง (ประมาณ)</span>
                </div>

                {/* Segment Restriction Controls */}
                {(() => {
                  const allowed = sec.allowedTypes || ['U', 'R', 'L'];
                  const allowU = allowed.includes('U');
                  const allowR = allowed.includes('R');
                  const allowL = allowed.includes('L');

                  return (
                    <div className="space-y-1.5 pt-2 border-t border-white/5 font-mono text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted font-bold uppercase">
                          อนุญาตการใช้ Segment (ห้ามใช้):
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAllowedType(idx, 'U')}
                          className={`py-1 px-1 rounded-lg border text-center font-bold transition-all ${
                            allowU
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 opacity-60'
                          }`}
                        >
                          {allowU ? '✅ UN (1.2m)' : '🚫 ห้ามใช้ UN'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAllowedType(idx, 'R')}
                          className={`py-1 px-1 rounded-lg border text-center font-bold transition-all ${
                            allowR
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 opacity-60'
                          }`}
                        >
                          {allowR ? '✅ RT (1.4m)' : '🚫 ห้ามใช้ RT'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAllowedType(idx, 'L')}
                          className={`py-1 px-1 rounded-lg border text-center font-bold transition-all ${
                            allowL
                              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 opacity-60'
                          }`}
                        >
                          {allowL ? '✅ LT (1.4m)' : '🚫 ห้ามใช้ LT'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Custom Ratio Controls */}
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-text-muted uppercase text-[10px]">
                      อัตราส่วน (UN : RT : LT)
                    </span>
                    <span className="font-mono font-bold text-acc bg-surf-3 px-2 py-0.5 rounded border border-white/5 text-[10px]">
                      {breakdown.ratioStr}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 font-mono">
                    <div className="bg-surf-3 p-1.5 rounded-lg border border-amber-500/30 text-center">
                      <span className="text-[9px] text-amber-300 font-bold block">UN (1.2m)</span>
                      <input
                        type="number"
                        min="0"
                        value={sec.ratio.un}
                        onChange={(e) => updateSectionRatio(idx, 'un', e.target.value)}
                        className="w-full bg-transparent text-amber-400 font-black text-base text-center outline-none"
                      />
                      <span className="text-[8px] text-text-muted block">{breakdown.unCount} ริง ({breakdown.unPct}%)</span>
                    </div>

                    <div className="bg-surf-3 p-1.5 rounded-lg border border-rose-500/30 text-center">
                      <span className="text-[9px] text-rose-300 font-bold block">RT (1.4m)</span>
                      <input
                        type="number"
                        min="0"
                        value={sec.ratio.rt}
                        onChange={(e) => updateSectionRatio(idx, 'rt', e.target.value)}
                        className="w-full bg-transparent text-rose-400 font-black text-base text-center outline-none"
                      />
                      <span className="text-[8px] text-text-muted block">{breakdown.rtCount} ริง ({breakdown.rtPct}%)</span>
                    </div>

                    <div className="bg-surf-3 p-1.5 rounded-lg border border-cyan-500/30 text-center">
                      <span className="text-[9px] text-cyan-300 font-bold block">LT (1.4m)</span>
                      <input
                        type="number"
                        min="0"
                        value={sec.ratio.lt}
                        onChange={(e) => updateSectionRatio(idx, 'lt', e.target.value)}
                        className="w-full bg-transparent text-cyan-400 font-black text-base text-center outline-none"
                      />
                      <span className="text-[8px] text-text-muted block">{breakdown.ltCount} ริง ({breakdown.ltPct}%)</span>
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1 font-mono text-[9px] pt-0.5">
                    {RATIO_PRESETS.slice(0, 4).map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyRatioPreset(idx, p)}
                        className={`px-1.5 py-0.5 rounded border transition-all ${
                          sec.ratio.un === p.un && sec.ratio.rt === p.rt && sec.ratio.lt === p.lt
                            ? 'bg-acc/20 border-acc text-acc font-bold shadow-sm'
                            : 'bg-surf-3 border-white/5 text-text-muted hover:border-white/20'
                        }`}
                      >
                        {p.un}:{p.rt}:{p.lt}
                      </button>
                    ))}
                  </div>

                  {/* Auto Optimize Button */}
                  <button
                    type="button"
                    onClick={() => handleAutoOptimizeRatio(idx)}
                    className="w-full mt-2 py-1.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30 hover:bg-purple-500/30 flex justify-center items-center gap-1.5 transition-all"
                  >
                    <Sparkles size={13} /> Auto-Optimize Ratio (ค้นหาอัตราส่วนที่ดีที่สุด)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </div>
        )}
      </div>

      {/* Visual Simulation Display (Sub-tabs: 2D Map / Trajectory Chart / Sequence Table) */}
      <div className="card space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('2d_map')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeSubTab === '2d_map'
                  ? 'bg-acc text-black shadow-md shadow-cyan-400/20'
                  : 'bg-surf-3 text-text-muted hover:text-white'
              }`}
            >
              <Eye size={16} /> 2D Tunnel Visual Map (จำลองแนวขับเคลื่อน 2 มิติ)
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('trajectory_chart')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeSubTab === 'trajectory_chart'
                  ? 'bg-acc text-black shadow-md shadow-cyan-400/20'
                  : 'bg-surf-3 text-text-muted hover:text-white'
              }`}
            >
              <TrendingUp size={16} /> Trajectory Chart (Lead vs STA)
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('table')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeSubTab === 'table'
                  ? 'bg-acc text-black shadow-md shadow-cyan-400/20'
                  : 'bg-surf-3 text-text-muted hover:text-white'
              }`}
            >
              <Layers size={16} /> Sequence Table ({planResult.plannedRings.length} Rings)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="btn btn-outline py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 hover:border-acc"
            >
              <Download size={15} /> Export Plan (CSV)
            </button>
          </div>
        </div>

        {/* View 1: 2D Visual Map Simulator (Interactive Segment Chain & DTA Alignment) */}
        {activeSubTab === '2d_map' && (
          <Tunnel2DVisualizer
            planResult={planResult}
            scrubStep={scrubStep}
            onSelectStep={setScrubStep}
          />
        )}

        {/* View 2: Trajectory Line Chart */}
        {activeSubTab === 'trajectory_chart' && (
          <div className="h-[320px] w-full pt-2">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}

        {/* View 3: Sequence Schedule Table */}
        {activeSubTab === 'table' && (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-white/10 text-text-muted bg-surf-3 shadow-md">
                  <th className="p-2.5">Step</th>
                  <th className="p-2.5">STA</th>
                  <th className="p-2.5">Ring No.</th>
                  <th className="p-2.5">Sec</th>
                  <th className="p-2.5">Key</th>
                  <th className="p-2.5">Suit.</th>
                  <th className="p-2.5">After H</th>
                  <th className="p-2.5">After V</th>
                  <th className="p-2.5">DTA Dev</th>
                  <th className="p-2.5">Tail Gap (L/R)</th>
                  <th className="p-2.5">Risk Score</th>
                  <th className="p-2.5">💡 AI Reasoning (เหตุผลการตัดสินใจ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {planResult.plannedRings.map((r) => {
                  const riskColor = 
                    r.riskIndex <= 25 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                    r.riskIndex <= 50 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                    r.riskIndex <= 75 ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' :
                    'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';

                  return (
                    <tr
                      key={r.step}
                      className={`hover:bg-white/5 transition-colors ${
                        r.exceedsLimit || r.isGapCrit ? 'bg-rose-500/10' : r.isGapWarn ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="p-2.5 text-text-muted font-bold">#{r.step}</td>
                      <td className="p-2.5 font-bold text-text">{r.sta}</td>
                      <td className="p-2.5 font-bold text-acc">{r.ringNum}</td>
                      <td className="p-2.5 text-text-muted font-bold">{r.sectionCode}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-black text-xs shadow-sm ${
                            r.type === 'R'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : r.type === 'L'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {r.selectedKey}
                        </span>
                        <span className="text-[10px] text-text-muted ml-1">({r.sizeM}m)</span>
                      </td>
                      <td className="p-2.5">
                        <KeySuitabilityBadge suitability={r.suitability} size="sm" />
                      </td>
                      <td
                        className={`p-2.5 font-bold ${
                          r.exceedsLimit ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {r.afterH > 0 ? `+${r.afterH}` : r.afterH} mm
                      </td>
                      <td className="p-2.5 font-semibold text-text">
                        {r.afterV > 0 ? `+${r.afterV}` : r.afterV} mm
                      </td>
                      <td className="p-2.5 text-cyan-400 font-bold">
                        {r.deviationMm > 0 ? `+${r.deviationMm}` : r.deviationMm} mm
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">
                        <span className={r.gapL < 15 ? 'text-amber-400 font-bold' : 'text-text-muted'}>L:{r.gapL}</span> /{' '}
                        <span className={r.gapR < 15 ? 'text-amber-400 font-bold' : 'text-text-muted'}>R:{r.gapR}</span>
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${riskColor}`}>
                          {r.riskIndex}<span className="text-[9px] opacity-70">/100</span>
                        </span>
                      </td>
                      <td className="p-2.5 font-sans text-xs text-text-muted max-w-xs truncate" title={r.aiReasoning}>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Lightbulb size={12} className="text-amber-400 shrink-0" />
                          <span className="truncate">{r.aiReasoning || 'ปกติ'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

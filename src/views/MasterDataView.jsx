import React, { useState, useMemo, useEffect } from 'react';
import { 
  Database, 
  Grid, 
  RotateCw, 
  Sliders, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Table,
  Layers,
  Compass,
  TrendingUp,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Download,
  Upload,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Info,
  Check,
  Ban
} from 'lucide-react';
import { KEY_DATA, SUITABILITY_MATRIX, TBM_SPECS } from '../data/tbmConstants';
import { calculateTaperGeometry } from '../services/calculator';
import { 
  DEFAULT_ALIGNMENT_SECTIONS, 
  DEFAULT_VERTICAL_ALIGNMENT,
  createNewSection, 
  createNewVerticalElement,
  parseSTA,
  formatSTA,
  estimateRingCount,
  DEFAULT_GAP_SETTINGS
} from '../services/advancePlanner';
import GapVisualizer from '../components/GapVisualizer';
import KeySuitabilityBadge from '../components/KeySuitabilityBadge';

export default function MasterDataView({ onNavigate = () => {} }) {
  const [activeTab, setActiveTab] = useState('horizontal'); // 'horizontal' | 'vertical' | 'keys' | 'suitability' | 'simulator'
  
  // LocalStorage State for Horizontal Alignment
  const [hSections, setHSections] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_horizontal_alignment');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_ALIGNMENT_SECTIONS;
  });

  // LocalStorage State for Vertical Alignment
  const [vProfile, setVProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_vertical_alignment');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_VERTICAL_ALIGNMENT;
  });

  // LocalStorage State for Tail Gap Settings
  const [gapSettings, setGapSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_gap_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_GAP_SETTINGS;
  });

  const [savedSuccessMsg, setSavedSuccessMsg] = useState('');

  // Taper simulator state
  const [simRoll, setSimRoll] = useState(0);
  const [simMaxTaper, setSimMaxTaper] = useState(60.0);
  const [simOD, setSimOD] = useState(6000.0);

  const dynamicGeometry = useMemo(() => {
    return calculateTaperGeometry(Number(simMaxTaper), Number(simOD), Number(simRoll));
  }, [simMaxTaper, simOD, simRoll]);

  const keyPositions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

  // Save Horizontal Alignment
  const handleSaveHAlignment = () => {
    try {
      localStorage.setItem('tbm_horizontal_alignment', JSON.stringify(hSections));
      setSavedSuccessMsg('บันทึกการตั้งค่าแนวราบ (Horizontal Alignment) เรียบร้อยแล้ว!');
      setTimeout(() => setSavedSuccessMsg(''), 4000);
    } catch (e) {
      alert('Error saving horizontal alignment: ' + e.message);
    }
  };

  // Save Vertical Alignment
  const handleSaveVAlignment = () => {
    try {
      localStorage.setItem('tbm_vertical_alignment', JSON.stringify(vProfile));
      setSavedSuccessMsg('บันทึกการตั้งค่าแนวดิ่ง (Vertical Alignment) เรียบร้อยแล้ว!');
      setTimeout(() => setSavedSuccessMsg(''), 4000);
    } catch (e) {
      alert('Error saving vertical alignment: ' + e.message);
    }
  };

  // Reset H Alignment
  const handleResetHAlignment = () => {
    if (window.confirm('รีเซ็ตแนวราบกลับเป็นค่ามาตรฐานตามแบบ Drawing (Sections 12", 13, 13A)?')) {
      setHSections(DEFAULT_ALIGNMENT_SECTIONS);
      localStorage.setItem('tbm_horizontal_alignment', JSON.stringify(DEFAULT_ALIGNMENT_SECTIONS));
      setSavedSuccessMsg('รีเซ็ตแนวราบเป็นค่ามาตรฐานเรียบร้อยแล้ว!');
      setTimeout(() => setSavedSuccessMsg(''), 3000);
    }
  };

  // Reset V Alignment
  const handleResetVAlignment = () => {
    if (window.confirm('รีเซ็ตแนวดิ่งกลับเป็นค่ามาตรฐานโปรไฟล์ของโครงการ?')) {
      setVProfile(DEFAULT_VERTICAL_ALIGNMENT);
      localStorage.setItem('tbm_vertical_alignment', JSON.stringify(DEFAULT_VERTICAL_ALIGNMENT));
      setSavedSuccessMsg('รีเซ็ตแนวดิ่งเป็นค่ามาตรฐานเรียบร้อยแล้ว!');
      setTimeout(() => setSavedSuccessMsg(''), 3000);
    }
  };

  // Apply to Advance Planner
  const handleApplyToPlanner = () => {
    handleSaveHAlignment();
    handleSaveVAlignment();
    onNavigate('advanceplanner');
  };

  // Add Section H
  const handleAddHSection = () => {
    const newSec = createNewSection('full_curve', 'right', 180);
    setHSections((prev) => [...prev, newSec]);
  };

  // Delete Section H
  const handleDeleteHSection = (idx) => {
    if (hSections.length <= 1) {
      alert('ต้องมีอย่างน้อย 1 ช่วง Alignment');
      return;
    }
    if (window.confirm(`ลบช่วง ${hSections[idx].code}?`)) {
      setHSections((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  // Toggle Segment Restriction in Section H
  const handleToggleAllowedType = (secIdx, typeCode) => {
    setHSections((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const currentAllowed = copy[secIdx].allowedTypes || ['U', 'R', 'L'];
      
      let nextAllowed;
      if (currentAllowed.includes(typeCode)) {
        // Remove it (must leave at least 1)
        if (currentAllowed.length <= 1) {
          alert('ต้องอนุญาตให้ใช้อย่างน้อย 1 ชนิด Segment');
          return prev;
        }
        nextAllowed = currentAllowed.filter((t) => t !== typeCode);
        // Also zero out its ratio
        if (typeCode === 'U') copy[secIdx].ratio.un = 0;
        if (typeCode === 'R') copy[secIdx].ratio.rt = 0;
        if (typeCode === 'L') copy[secIdx].ratio.lt = 0;
      } else {
        // Add it back
        nextAllowed = [...currentAllowed, typeCode];
        if (typeCode === 'U' && copy[secIdx].ratio.un === 0) copy[secIdx].ratio.un = 1;
        if (typeCode === 'R' && copy[secIdx].ratio.rt === 0) copy[secIdx].ratio.rt = 1;
        if (typeCode === 'L' && copy[secIdx].ratio.lt === 0) copy[secIdx].ratio.lt = 1;
      }
      
      copy[secIdx].allowedTypes = nextAllowed;
      return copy;
    });
  };

  // Add VPI Element
  const handleAddVElem = () => {
    const newElem = createNewVerticalElement();
    setVProfile((prev) => [...prev, newElem]);
  };

  // Delete VPI Element
  const handleDeleteVElem = (idx) => {
    if (vProfile.length <= 1) {
      alert('ต้องมีอย่างน้อย 1 ช่วงแนวดิ่ง');
      return;
    }
    if (window.confirm(`ลบช่วงแนวดิ่ง ${vProfile[idx].code}?`)) {
      setVProfile((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surf-2 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
              <Compass size={13} /> MASTER SETTINGS & ALIGNMENT
            </span>
            <span className="text-xs text-text-muted">MRT Purple Line Engineering Configuration</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">Alignment Master Data, Segment Rules & Geometry</h2>
          <p className="text-sm text-text-muted mt-1">
            ตั้งค่าแนวราบ (H Alignment), แนวดิ่ง (V Alignment), ข้อจำกัดการใช้ Segment (ห้ามใช้ UN/RT/LT), และฐานข้อมูล 33 คีย์
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 bg-surf-3 p-1 rounded-xl border border-white/10 font-mono text-xs">
          <button
            onClick={() => setActiveTab('horizontal')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'horizontal' ? 'bg-acc text-black shadow-md' : 'text-text-muted hover:text-text'
            }`}
          >
            <Compass size={14} /> แนวราบ & สัดส่วน Ratio (H Alignment & Ratio)
          </button>
          <button
            onClick={() => setActiveTab('vertical')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'vertical' ? 'bg-acc text-black shadow-md' : 'text-text-muted hover:text-text'
            }`}
          >
            <TrendingUp size={14} /> แนวดิ่ง (V Alignment)
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'keys' ? 'bg-acc text-black shadow-md' : 'text-text-muted hover:text-text'
            }`}
          >
            33 Key Database
          </button>
          <button
            onClick={() => setActiveTab('suitability')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'suitability' ? 'bg-acc text-black font-bold' : 'text-text-muted hover:text-text'
            }`}
          >
            Suitability Matrix
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'simulator' ? 'bg-acc text-black font-bold' : 'text-text-muted hover:text-text'
            }`}
          >
            Taper Simulator
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {savedSuccessMsg && (
        <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-sm font-medium animate-in fade-in">
          <CheckCircle2 size={18} />
          <span>{savedSuccessMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: Horizontal Alignment Settings & Segment Rules */}
      {/* ========================================================================= */}
      {activeTab === 'horizontal' && (
        <div className="card space-y-5 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <Compass size={18} className="text-acc" /> จัดการแนวราบ (Horizontal Alignment) & กฎห้ามใช้ Segment
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                กำหนดช่วงแนวราบ รัศมีโค้ง ระยะ STA และเลือกเปิด/ปิด Segment ที่อนุญาตหรือห้ามใช้ในแต่ละช่วง
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={handleAddHSection}
                className="btn btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/15"
              >
                <Plus size={15} /> + เพิ่มช่วง Alignment
              </button>

              <button
                type="button"
                onClick={handleResetHAlignment}
                className="btn btn-outline py-2 px-3 text-xs font-sans flex items-center gap-1.5 text-text-muted hover:text-white"
              >
                <RotateCcw size={14} /> รีเซ็ตตามแบบ
              </button>

              <button
                type="button"
                onClick={handleSaveHAlignment}
                className="btn btn-yes py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <Save size={15} /> บันทึกแนวราบ (Save)
              </button>

              <button
                type="button"
                onClick={handleApplyToPlanner}
                className="btn px-4 py-2 text-xs font-bold flex items-center gap-1.5 bg-acc text-black hover:bg-cyan-300 shadow-lg shadow-cyan-400/20"
              >
                <Sparkles size={15} /> นำไปใช้ใน Advance Planner
              </button>
            </div>
          </div>

          {/* Section Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hSections.map((sec, idx) => {
              const allowed = sec.allowedTypes || ['U', 'R', 'L'];
              const allowU = allowed.includes('U');
              const allowR = allowed.includes('R');
              const allowL = allowed.includes('L');
              const dist = Math.abs(parseSTA(sec.endSTA) - parseSTA(sec.startSTA));
              const estRings = estimateRingCount(sec.startSTA, sec.endSTA, sec.ratio);

              return (
                <div
                  key={sec.id}
                  className="bg-surf-2 border border-white/10 rounded-2xl p-4 space-y-3.5 hover:border-acc/40 transition-all relative group"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sec.code}
                        onChange={(e) => {
                          const copy = [...hSections];
                          copy[idx].code = e.target.value;
                          setHSections(copy);
                        }}
                        className="w-16 px-2 py-0.5 rounded font-mono font-bold text-xs bg-surf-3 border border-white/15 text-acc text-center outline-none"
                      />
                      <input
                        type="text"
                        value={sec.name}
                        onChange={(e) => {
                          const copy = [...hSections];
                          copy[idx].name = e.target.value;
                          setHSections(copy);
                        }}
                        className="font-bold text-text text-xs bg-transparent border-b border-transparent focus:border-white/20 outline-none truncate"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteHSection(idx)}
                      className="p-1 rounded text-text-muted hover:text-rose-400 hover:bg-white/5 transition-colors"
                      title="Delete Section"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Section Geometry Parameters */}
                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                    <div className="field">
                      <label className="text-[9px] text-text-muted block">Type</label>
                      <select
                        value={sec.sectionType}
                        onChange={(e) => {
                          const copy = [...hSections];
                          copy[idx].sectionType = e.target.value;
                          setHSections(copy);
                        }}
                        className="w-full bg-surf-3 border border-white/10 text-text text-[11px] p-1.5 rounded outline-none"
                      >
                        <option value="full_curve">Full Curve</option>
                        <option value="transition_in">Transition (In)</option>
                        <option value="transition_out">Transition (Out)</option>
                        <option value="tangent">Tangent (ตรง)</option>
                      </select>
                    </div>

                    <div className="field">
                      <label className="text-[9px] text-text-muted block">Direction</label>
                      <select
                        value={sec.direction}
                        onChange={(e) => {
                          const copy = [...hSections];
                          copy[idx].direction = e.target.value;
                          setHSections(copy);
                        }}
                        className="w-full bg-surf-3 border border-white/10 text-text text-[11px] p-1.5 rounded outline-none"
                      >
                        <option value="right">Right (ขวา)</option>
                        <option value="left">Left (ซ้าย)</option>
                        <option value="straight">Straight</option>
                      </select>
                    </div>

                    <div className="field">
                      <label className="text-[9px] text-text-muted block">Radius (m)</label>
                      <input
                        type="number"
                        value={sec.radius}
                        onChange={(e) => {
                          const copy = [...hSections];
                          copy[idx].radius = Number(e.target.value) || 0;
                          setHSections(copy);
                        }}
                        className="w-full bg-surf-3 border border-white/10 text-amber-400 font-bold text-[11px] p-1.5 rounded text-center outline-none"
                      />
                    </div>
                  </div>

                  {/* STA Range Inputs */}
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-surf-3/60 p-2.5 rounded-xl border border-white/5">
                    <div>
                      <span className="text-text-muted text-[10px] block">Start STA</span>
                      <input
                        type="text"
                        value={sec.startSTA}
                        onChange={(e) => {
                          const copy = [...hSections];
                          copy[idx].startSTA = e.target.value;
                          setHSections(copy);
                        }}
                        className="w-full bg-surf-2 border border-white/10 font-bold text-acc rounded px-1.5 py-1 text-center outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-text-muted text-[10px] block">End STA</span>
                      <input
                        type="text"
                        value={sec.endSTA}
                        onChange={(e) => {
                          const copy = [...hSections];
                          copy[idx].endSTA = e.target.value;
                          setHSections(copy);
                        }}
                        className="w-full bg-surf-2 border border-white/10 font-bold text-amber-400 rounded px-1.5 py-1 text-center outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted px-1">
                    <span>ระยะทาง: <strong className="text-text">{dist.toFixed(1)}m</strong></span>
                    <span>~<strong className="text-text">{estRings}</strong> ริง (ประมาณ)</span>
                  </div>

                  {/* Segment Restriction Controls */}
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-text-muted uppercase text-[10px] flex items-center gap-1">
                        <Ban size={12} className="text-rose-400" /> กฎการเลือกใช้ Segment:
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                      {/* UN Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAllowedType(idx, 'U')}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          allowU
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-sm'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400 opacity-60'
                        }`}
                      >
                        <span>{allowU ? '✅ อนุญาต UN' : '🚫 ห้ามใช้ UN'}</span>
                        <span className="text-[9px] opacity-75">(1.2m)</span>
                      </button>

                      {/* RT Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAllowedType(idx, 'R')}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          allowR
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold shadow-sm'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400 opacity-60'
                        }`}
                      >
                        <span>{allowR ? '✅ อนุญาต RT' : '🚫 ห้ามใช้ RT'}</span>
                        <span className="text-[9px] opacity-75">(1.4m)</span>
                      </button>

                      {/* LT Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleAllowedType(idx, 'L')}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          allowL
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400 opacity-60'
                        }`}
                      >
                        <span>{allowL ? '✅ อนุญาต LT' : '🚫 ห้ามใช้ LT'}</span>
                        <span className="text-[9px] opacity-75">(1.4m)</span>
                      </button>
                    </div>
                  </div>

                  {/* Ratio Inputs */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-text-muted uppercase block font-bold">
                      สัดส่วนเป้าหมาย (Target Ratio):
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 font-mono">
                      <div className={`p-1.5 rounded-lg border text-center ${allowU ? 'bg-surf-3 border-amber-500/30' : 'bg-surf-3/30 border-white/5 opacity-40'}`}>
                        <span className="text-[9px] text-amber-300 block font-bold">UN</span>
                        <input
                          type="number"
                          min="0"
                          disabled={!allowU}
                          value={sec.ratio.un}
                          onChange={(e) => {
                            const copy = [...hSections];
                            copy[idx].ratio.un = Math.max(0, Number(e.target.value) || 0);
                            setHSections(copy);
                          }}
                          className="w-full bg-transparent text-amber-400 font-black text-center outline-none text-sm"
                        />
                      </div>

                      <div className={`p-1.5 rounded-lg border text-center ${allowR ? 'bg-surf-3 border-rose-500/30' : 'bg-surf-3/30 border-white/5 opacity-40'}`}>
                        <span className="text-[9px] text-rose-300 block font-bold">RT</span>
                        <input
                          type="number"
                          min="0"
                          disabled={!allowR}
                          value={sec.ratio.rt}
                          onChange={(e) => {
                            const copy = [...hSections];
                            copy[idx].ratio.rt = Math.max(0, Number(e.target.value) || 0);
                            setHSections(copy);
                          }}
                          className="w-full bg-transparent text-rose-400 font-black text-center outline-none text-sm"
                        />
                      </div>

                      <div className={`p-1.5 rounded-lg border text-center ${allowL ? 'bg-surf-3 border-cyan-500/30' : 'bg-surf-3/30 border-white/5 opacity-40'}`}>
                        <span className="text-[9px] text-cyan-300 block font-bold">LT</span>
                        <input
                          type="number"
                          min="0"
                          disabled={!allowL}
                          value={sec.ratio.lt}
                          onChange={(e) => {
                            const copy = [...hSections];
                            copy[idx].ratio.lt = Math.max(0, Number(e.target.value) || 0);
                            setHSections(copy);
                          }}
                          className="w-full bg-transparent text-cyan-400 font-black text-center outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1 font-mono text-[9px] pt-1">
                      {[
                        { label: '3:1:0', r: { un: 3, rt: 1, lt: 0 } },
                        { label: '2:1:0', r: { un: 2, rt: 1, lt: 0 } },
                        { label: '1:1:1', r: { un: 1, rt: 1, lt: 1 } },
                        { label: '0:23:13', r: { un: 0, rt: 23, lt: 13 } },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const copy = [...hSections];
                            copy[idx].ratio = {
                              un: allowU ? preset.r.un : 0,
                              rt: allowR ? preset.r.rt : 0,
                              lt: allowL ? preset.r.lt : 0,
                            };
                            setHSections(copy);
                          }}
                          className="px-1.5 py-0.5 rounded bg-surf-3 hover:bg-white/10 text-text-muted hover:text-white border border-white/5"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Auto Optimize Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const best = findBestRatioForSection(sec);
                        const copy = [...hSections];
                        copy[idx].ratio = best;
                        setHSections(copy);
                      }}
                      className="w-full mt-1 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors font-sans"
                    >
                      <Sparkles size={12} /> Auto-Optimize Ratio (ค้นหาอัตราส่วนที่ดีที่สุด)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Vertical Alignment Settings (VPI, Elevations & Gradients) */}
      {/* ========================================================================= */}
      {activeTab === 'vertical' && (
        <div className="card space-y-5 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={18} className="text-acc" /> จัดการแนวดิ่ง (Vertical Alignment & Profiles)
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                กำหนดระดับความชัน (Grade %), ระดับความสูง (Elevation m. MSL), และโค้งแนวดิ่ง (Crest / Sag Curves)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={handleAddVElem}
                className="btn btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/15"
              >
                <Plus size={15} /> + เพิ่มช่วงแนวดิ่ง (VPI)
              </button>

              <button
                type="button"
                onClick={handleResetVAlignment}
                className="btn btn-outline py-2 px-3 text-xs font-sans flex items-center gap-1.5 text-text-muted hover:text-white"
              >
                <RotateCcw size={14} /> รีเซ็ตตามแบบ
              </button>

              <button
                type="button"
                onClick={handleSaveVAlignment}
                className="btn btn-yes py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <Save size={15} /> บันทึกแนวดิ่ง (Save)
              </button>

              <button
                type="button"
                onClick={handleApplyToPlanner}
                className="btn px-4 py-2 text-xs font-bold flex items-center gap-1.5 bg-acc text-black hover:bg-cyan-300 shadow-lg shadow-cyan-400/20"
              >
                <Sparkles size={15} /> นำไปใช้ใน Advance Planner
              </button>
            </div>
          </div>

          {/* Vertical Elements Table / Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vProfile.map((elem, idx) => (
              <div
                key={elem.id}
                className="bg-surf-2 border border-white/10 rounded-2xl p-4 space-y-3 hover:border-acc/40 transition-all relative"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={elem.code}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].code = e.target.value;
                        setVProfile(copy);
                      }}
                      className="w-20 px-2 py-0.5 rounded font-mono font-bold text-xs bg-surf-3 border border-white/15 text-acc text-center outline-none"
                    />
                    <input
                      type="text"
                      value={elem.name}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].name = e.target.value;
                        setVProfile(copy);
                      }}
                      className="font-bold text-text text-xs bg-transparent border-b border-transparent focus:border-white/20 outline-none truncate"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteVElem(idx)}
                    className="p-1 rounded text-text-muted hover:text-rose-400 hover:bg-white/5 transition-colors"
                    title="Delete Element"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* STA Range */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-surf-3/60 p-2 rounded-xl border border-white/5">
                  <div>
                    <span className="text-text-muted text-[10px] block">Start STA</span>
                    <input
                      type="text"
                      value={elem.startSTA}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].startSTA = e.target.value;
                        setVProfile(copy);
                      }}
                      className="w-full bg-surf-2 border border-white/10 font-bold text-acc rounded px-1.5 py-1 text-center outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-text-muted text-[10px] block">End STA</span>
                    <input
                      type="text"
                      value={elem.endSTA}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].endSTA = e.target.value;
                        setVProfile(copy);
                      }}
                      className="w-full bg-surf-2 border border-white/10 font-bold text-amber-400 rounded px-1.5 py-1 text-center outline-none"
                    />
                  </div>
                </div>

                {/* Elevation & Grade */}
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-text-muted text-[10px] block">Start Elev (m)</span>
                    <input
                      type="number"
                      step="0.001"
                      value={elem.startElev}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].startElev = Number(e.target.value) || 0;
                        setVProfile(copy);
                      }}
                      className="w-full bg-surf-3 border border-white/10 text-text font-bold p-1 rounded text-center outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-text-muted text-[10px] block">End Elev (m)</span>
                    <input
                      type="number"
                      step="0.001"
                      value={elem.endElev}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].endElev = Number(e.target.value) || 0;
                        setVProfile(copy);
                      }}
                      className="w-full bg-surf-3 border border-white/10 text-text font-bold p-1 rounded text-center outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-text-muted text-[10px] block">Grade (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={elem.gradePct}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].gradePct = Number(e.target.value) || 0;
                        setVProfile(copy);
                      }}
                      className={`w-full bg-surf-3 border border-white/10 font-bold p-1 rounded text-center outline-none ${
                        elem.gradePct > 0 ? 'text-emerald-400' : elem.gradePct < 0 ? 'text-cyan-400' : 'text-text'
                      }`}
                    />
                  </div>
                </div>

                {/* Curve Type & Radius */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="text-text-muted text-[10px] block">Vertical Curve</span>
                    <select
                      value={elem.curveType}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].curveType = e.target.value;
                        setVProfile(copy);
                      }}
                      className="w-full bg-surf-3 border border-white/10 text-text p-1 rounded outline-none"
                    >
                      <option value="constant_grade">ทางลาดตรง (Grade)</option>
                      <option value="sag_curve">โค้งแอ่ง (Sag Curve)</option>
                      <option value="crest_curve">โค้งหลังเต่า (Crest)</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-text-muted text-[10px] block">Radius Rv (m)</span>
                    <input
                      type="number"
                      value={elem.radiusV}
                      onChange={(e) => {
                        const copy = [...vProfile];
                        copy[idx].radiusV = Number(e.target.value) || 0;
                        setVProfile(copy);
                      }}
                      disabled={elem.curveType === 'constant_grade'}
                      className="w-full bg-surf-3 border border-white/10 text-purple-300 font-bold p-1 rounded text-center outline-none disabled:opacity-30"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: 33 Key Database Table */}
      {/* ========================================================================= */}
      {activeTab === 'keys' && (
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <Database size={16} className="text-acc" /> Standard 33 Key Positions & Lead Specifications
              </h3>
              <p className="text-xs text-text-muted">Geometry defined for Right (R), Left (L), and Universal (U) segments</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['R', 'L', 'U'].map((t) => {
              const keys = Object.values(KEY_DATA).filter(k => k.type === t);
              const title = t === 'R' ? 'Right Taper (R)' : t === 'L' ? 'Left Taper (L)' : 'Universal (U)';
              const color = t === 'R' ? 'text-rose-400' : t === 'L' ? 'text-cyan-400' : 'text-amber-400';

              return (
                <div key={t} className="bg-surf-3/60 rounded-xl p-4 border border-white/5 space-y-3">
                  <h4 className={`text-sm font-bold font-mono ${color} border-b border-white/5 pb-2`}>
                    {title} ({keys.length} Keys)
                  </h4>
                  <div className="space-y-1.5 font-mono text-xs">
                    {keys.map((k) => (
                      <div key={k.key} className="flex items-center justify-between py-1 border-b border-white/5 hover:bg-white/5 px-2 rounded">
                        <span className="font-bold text-text">{k.key} (Pos {k.pos})</span>
                        <div className="flex gap-3 text-text-muted">
                          <span>H: <strong className={k.hLead < 0 ? 'text-rose-300' : k.hLead > 0 ? 'text-emerald-300' : 'text-text'}>{k.hLead}</strong></span>
                          <span>V: <strong className={k.vLead < 0 ? 'text-rose-300' : k.vLead > 0 ? 'text-emerald-300' : 'text-text'}>{k.vLead}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Suitability Matrix */}
      {/* ========================================================================= */}
      {activeTab === 'suitability' && (
        <div className="card space-y-4 p-5">
          <div>
            <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
              <Grid size={16} className="text-acc" /> 16x16 Bolt Connection Suitability Matrix
            </h3>
            <p className="text-xs text-text-muted">Direct mapping of key position connectivity compatibility</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-2 text-text-muted bg-surf-3">Prev \ Next</th>
                  {keyPositions.map((p) => (
                    <th key={p} className="p-2 text-acc font-bold bg-surf-3">P{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {keyPositions.map((prev) => (
                  <tr key={prev} className="hover:bg-white/5">
                    <td className="p-2 font-bold text-acc bg-surf-3 border-r border-white/10">P{prev}</td>
                    {keyPositions.map((next) => {
                      const suit = SUITABILITY_MATRIX[prev]?.[next] || 'No';
                      return (
                        <td key={next} className="p-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold block ${
                              suit === 'Yes'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : suit === 'Fair'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 opacity-40'
                            }`}
                          >
                            {suit}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: Dynamic Taper Simulator */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="card space-y-6 p-5">
          <div>
            <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
              <RotateCw size={16} className="text-acc" /> Trigonometric Dynamic Taper Simulator
            </h3>
            <p className="text-xs text-text-muted">Simulate ring roll and calculate dynamic lead across all 16 key positions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surf-3/60 p-4 rounded-xl border border-white/5 font-mono text-xs">
            <div>
              <label className="text-text-muted block mb-1">Tunnel Outer Diameter (OD mm)</label>
              <input
                type="number"
                value={simOD}
                onChange={(e) => setSimOD(Number(e.target.value))}
                className="w-full bg-surf-2 border border-white/10 p-2 rounded-lg font-bold text-text outline-none"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Max Taper (mm)</label>
              <input
                type="number"
                value={simMaxTaper}
                onChange={(e) => setSimMaxTaper(Number(e.target.value))}
                className="w-full bg-surf-2 border border-white/10 p-2 rounded-lg font-bold text-text outline-none"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">Ring Roll Rotation Angle (&deg;)</label>
              <input
                type="number"
                value={simRoll}
                onChange={(e) => setSimRoll(Number(e.target.value))}
                className="w-full bg-surf-2 border border-white/10 p-2 rounded-lg font-bold text-acc outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 font-mono text-xs">
            {keyPositions.map((pos) => {
              const geom = dynamicGeometry[pos] || { hLead: 0, vLead: 0, angle: 0 };
              return (
                <div key={pos} className="bg-surf-2 border border-white/10 p-2.5 rounded-xl text-center space-y-1">
                  <span className="text-[11px] font-bold text-acc block">Pos {pos} ({geom.angle}&deg;)</span>
                  <div className="text-[10px] text-text-muted space-y-0.5">
                    <div>H: <strong className="text-text">{geom.hLead}</strong></div>
                    <div>V: <strong className="text-text">{geom.vLead}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

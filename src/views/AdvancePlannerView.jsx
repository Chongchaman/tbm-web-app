import { PageHeader, PlanInsight, StatCard, Field, ValidationErrors, InsightPanel } from '../components/PlannerUI';
import LeadChart from '../components/LeadChart';
import RecoveryChart from '../components/RecoveryChart';
import { DEFAULT_RECOVERY } from '../services/alignmentRecovery';
import { latestMeasured, nextRingNumber, ringNumber, summarizeRings, getLimits, assessRing, exportCSV, validateAlignment, validatePlanningInput } from '../services/decisionSupport';
import { useEffect, useState } from 'react';
import { Sparkles, Layers, Sliders, TrendingUp, CheckCircle2, Download, Plus, Trash2, SlidersHorizontal, RotateCcw, Eye, Save, Lock, Lightbulb } from 'lucide-react';


import KeySuitabilityBadge from '../components/KeySuitabilityBadge';
import GapVisualizer from '../components/GapVisualizer';
import Tunnel2DVisualizer from '../components/Tunnel2DVisualizer';
import { DEFAULT_ALIGNMENT_SECTIONS, DEFAULT_VERTICAL_ALIGNMENT, RATIO_PRESETS, runAdvancePlan, computeRatioBreakdown, estimateRingCount, createNewSection, findBestRatioForSection, DEFAULT_GAP_SETTINGS, parseSTA } from '../services/advancePlanner';
import { KEY_DATA } from '../data/tbmConstants';
import { soilAt, soilSheetAt, soilLevelAtStation, stationMeters } from '../services/soilProfile';




export default function AdvancePlannerView({ ringLogs = [], onBatchSave = () => {}, onNavigate = () => {}, theme = 'dark', track = 'EB' }) {
  const trackRingLogs = ringLogs.filter(r => r.track === track);
  const lastRing = latestMeasured(trackRingLogs) || trackRingLogs.at(-1) || null;
  const [savedSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`tbm_advance_session_${track}`)) || {}; }
    catch { return {}; }
  });
  const [soilElevations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tbm_soil_levels')) || { EB:'', WB:'' }; }
    catch { return { EB:'', WB:'' }; }
  });
  const [soilLevelStations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tbm_soil_level_stations')) || {}; }
    catch { return {}; }
  });

  // Sections State (Dynamic CRUD & LocalStorage sync with safe fallback)
  const [sections, setSections] = useState(() => {
    if (Array.isArray(savedSession.sections) && savedSession.sections.length) return savedSession.sections;
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
    if (Array.isArray(savedSession.vProfile) && savedSession.vProfile.length) return savedSession.vProfile;
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
  const [strategy, setStrategy] = useState(savedSession.strategy || 'senior_ai');

  // Tail Gap Configuration
  const [gapSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_gap_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return { ...DEFAULT_GAP_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_GAP_SETTINGS;
  });

  const [isSectionConfigExpanded, setIsSectionConfigExpanded] = useState(false);

  const [startKey, setStartKey] = useState(savedSession.startKey ?? (lastRing ? lastRing.key : 'U4'));
  const [startHLead, setStartHLead] = useState(savedSession.startHLead ?? (lastRing ? lastRing.hLead : 0));
  const [startVLead, setStartVLead] = useState(savedSession.startVLead ?? (lastRing ? lastRing.vLead : 0));
  const [currentSTA, setCurrentSTA] = useState(savedSession.currentSTA ?? (sections[0]?.startSTA || ''));
  const effectiveSoilElevations = {
    EB:soilLevelAtStation(soilElevations,soilLevelStations,'EB',currentSTA),
    WB:soilLevelAtStation(soilElevations,soilLevelStations,'WB',currentSTA),
  };
  const [recovery, setRecovery] = useState(savedSession.recovery ? {...DEFAULT_RECOVERY,...savedSession.recovery} : {...DEFAULT_RECOVERY});
  const [maxTolerance, setMaxTolerance] = useState(savedSession.maxTolerance ?? 55.0);
  const [steeringSign, setSteeringSign] = useState(savedSession.steeringSign || 'steering_bias'); // 'steering_bias' (Right = -)
  const [activeSubTab, setActiveSubTab] = useState('2d_map'); // '2d_map' | 'trajectory_chart' | 'table'

  // Explicit Calculation Trigger State
  const [isCalculated, setIsCalculated] = useState(true);
  const [needsRecalc, setNeedsRecalc] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Active Simulation Step Index for 2D Map Scrubber
  const [scrubStep, setScrubStep] = useState(1);
  const [resultFilter, setResultFilter] = useState('all');
  const [inputErrors, setInputErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const soilForPlannedRing = ring => {
    const ringSTA = stationMeters(ring.sta);
    const inputSTA = stationMeters(currentSTA);
    return ringSTA !== null && inputSTA !== null && Math.abs(ringSTA - inputSTA) < 0.5
      ? soilAt(ring.sta, track, effectiveSoilElevations[track])
      : { status:'needs-ring-elevation', sheet:soilSheetAt(ring.sta, track) };
  };

  useEffect(() => {
    try { localStorage.setItem(`tbm_advance_session_${track}`, JSON.stringify({ ...savedSession, sections, vProfile, strategy,
      startKey, startHLead, startVLead, currentSTA, recovery, maxTolerance, steeringSign })); }
    catch (error) { console.error('Cannot save track planning session', error); }
  }, [track, savedSession, sections, vProfile, strategy, startKey, startHLead, startVLead, currentSTA, recovery, maxTolerance, steeringSign]);
  // Plan Calculation State (Safe initialization)
  const [planResult, setPlanResult] = useState(() => {
    try {
      return runAdvancePlan({ sections, verticalAlignment: vProfile, startKey, startHLead, startVLead, maxTolerance, steeringSign, strategy, gapSettings, ringLogs:trackRingLogs, startSTA:currentSTA, recovery, startRingNumber: ringNumber({ ringNum: nextRingNumber(trackRingLogs) }) });
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
        verdict: { status: 'UNKNOWN', message: 'ตรวจข้อมูลก่อนคำนวณ', advice: [] },
      };
    }
  });

  // Calculate Action Handler
  const handleCalculate = () => {
    const errors = [...validatePlanningInput({ startKey, startHLead, startVLead, maxTolerance }), ...validateAlignment(sections, vProfile)];
    if (errors.length) { setInputErrors(errors); setNeedsRecalc(true); return; }
    try {
      const res = runAdvancePlan({ sections, verticalAlignment:vProfile, startKey, startHLead, startVLead, maxTolerance, steeringSign, strategy, gapSettings, ringLogs:trackRingLogs, startSTA:currentSTA, recovery, startRingNumber: ringNumber({ringNum:nextRingNumber(trackRingLogs)}) });
      setPlanResult(res); setIsCalculated(true); setNeedsRecalc(false); setScrubStep(1); setInputErrors([]);
    } catch (error) { setInputErrors([error.message]); setNeedsRecalc(true); }
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
    let bestRatio;
    try { bestRatio = findBestRatioForSection(sec, startKey, startHLead, startVLead, maxTolerance, gapSettings); } catch(error) { setInputErrors([error.message]); return; }
    
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

  // Batch Save
  const handleBatchSave = async () => {
    if (!isCalculated || needsRecalc || saving || !planResult.plannedRings.length) return;
    setSaving(true);
    try {
      await onBatchSave(planResult.plannedRings.map(r=>({ ...r, track, key:r.selectedKey, hLead:r.afterH, vLead:r.afterV,
        soilDrawing:soilForPlannedRing(r).sheet?.drawing || '', soilStatus:soilForPlannedRing(r).status,
        soilClass:soilForPlannedRing(r).soil?.label || '',
        recordType:'planned', timestamp:new Date().toISOString() })));
      setAppliedSuccess(true);
    } catch(error) { setInputErrors([error.message]); } finally { setSaving(false); }
  };

  // Export Plan to CSV
  const handleExportCSV = () => {
    const headers = [
      'Tunnel', 'Soil center level (mRL)', 'Soil class (interpreted)', 'Soil reading status', 'Soil drawing',
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
      'DTA H Deviation (mm)', 'DTA V Deviation (mm)', 'Along Alignment Endpoint Lag (mm)', 'Heading Error (deg)', 'Pitch Error (deg)',
      'Recovery Target H (mm)', 'Recovery Target V (mm)', 'End STA', 'Simulated Distance within Ring (m)', 'Initial Pose Source',
      'Suitability',
      'Tail Gap Min (mm)',
      'Gap Left (mm)',
      'Gap Right (mm)',
      'Gap Top (mm)',
      'Gap Bottom (mm)',
      'Risk Score (0-100)',
      'Estimated Taper Turn (deg)',
      'AI Reasoning',
      'Lead Limit Status', 'Endpoint Assessment', 'Overall Plan Verdict',
    ];

    const rows = planResult.plannedRings.map((r) => [
      track, Math.abs((stationMeters(r.sta) ?? -1e9) - (stationMeters(currentSTA) ?? 1e9)) < 0.5 ? effectiveSoilElevations[track] : '',
      soilForPlannedRing(r).soil?.english || '', soilForPlannedRing(r).status, soilForPlannedRing(r).sheet?.drawing || '',
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
      r.deviationVMm, r.longitudinalDeviationMm, r.headingErrorDeg, r.pitchErrorDeg, r.targetDeviationH, r.targetDeviationV, r.endSTA, r.simulatedLengthM,
      planResult.recovery?.initialStateConfirmed ? 'Survey/Navigation entered by user' : 'Assumed/example pose',
      r.suitability,
      r.minGap,
      r.gapL,
      r.gapR,
      r.gapT,
      r.gapB,
      r.riskIndex,
      r.articulationDeg,
      r.aiReasoning || '',
      r.exceedsLimit ? `EXCEEDED by +${r.overLimitAmount}mm` : `OK (<=${planResult.maxTolerance}mm)`,
      planResult.endpoint ? `Position:${planResult.endpoint.positionPass} Heading:${planResult.endpoint.headingPass} InitialPoseKnown:${planResult.endpoint.known}` : 'Unknown',
      planResult.verdict.status,
    ]);

    exportCSV(`tbm-advance-plan-${track}.csv`, headers, rows);
  };

  const summary = planResult.summary || summarizeRings(planResult.plannedRings, {...getLimits(gapSettings),lead:Number(maxTolerance)});
  const selectedRing = planResult.plannedRings[scrubStep-1];
  const tableRings = summary.assessed.filter(r => resultFilter==='all' || resultFilter==='issues' && r.level!=='normal' || r.issues.some(i=>i.code===resultFilter)).map(r=>r.ring);
  const showIssues = filter => { setResultFilter(filter); setActiveSubTab('table'); };


  return (
    <div className="stack pb-12">
      <PageHeader eyebrow={`Alignment planning · ${track==='EB'?'TBM1':'TBM2'} · DTA simulator`} title={`วางแผนแนวอุโมงค์ ${track==='EB'?'TBM1 (EB)':'TBM2 (WB)'}`} description="ดูสถานะทั้งแผน เลือกริงเพื่อตรวจรายละเอียด และแยกผลคาดการณ์ออกจากค่าตรวจสนาม" actions={<>
        <button className="btn btn-outline" onClick={()=>onNavigate('position')}>ดูภาพตำแหน่งหัวเจาะ</button>
        <button className="btn btn-outline" onClick={()=>onNavigate('soil')}>เปิดข้อมูลชั้นดิน</button>
        <button className="btn btn-acc" onClick={handleCalculate}>{needsRecalc?'คำนวณใหม่จากค่าที่แก้':'คำนวณแผน'}</button>
        <button className="btn btn-outline" onClick={handleBatchSave} disabled={needsRecalc||saving||!planResult.plannedRings.length}>{saving?'กำลังบันทึก…':'เก็บเป็นแผนคาดการณ์'}</button>
      </>}/>
      <ValidationErrors errors={inputErrors}/>
      <p className="section-note">แผน {track} เก็บค่าตั้งต้นและช่วง Alignment แยกจากอีกแนว · ดูชั้นดิน EB/WB และกรอกระดับ mRL ได้ที่หน้า “ข้อมูลชั้นดิน” · ค่า Alignment เดิมใน Master Settings เป็นเพียงต้นแบบ ต้องตรวจให้ตรงแบบโครงการ</p>
      {needsRecalc && <InsightPanel level="warning" title="ข้อมูลเปลี่ยนแล้ว ผลด้านล่างเป็นแผนก่อนแก้ไข"><p>คำนวณใหม่ก่อนส่งออกหรือบันทึกแผน</p></InsightPanel>}
      {appliedSuccess && (
        <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-sm font-medium">
          <CheckCircle2 size={18} />
          <span>เก็บแผนคาดการณ์ {planResult.plannedRings.length} ริงแล้ว · แยกจากข้อมูลสนาม</span>
        </div>
      )}

      <section className="card stack" aria-label="ข้อมูลตั้งต้นและการกลับเข้าแนว">
        <div><h3>ตำแหน่งหัวเจาะปัจจุบันและแผนกลับเข้าแนว</h3><p className="section-note">กรอกค่าจาก Survey / Navigation ที่ STA เดียวกัน · H บวกขวา / V บวกขึ้น เมื่อมองตามทิศขุด · มุมคลาดวัดเทียบกับเส้นสัมผัส Alignment ไม่ใช่มุมทิศหรือความชันสัมบูรณ์ · Lead เป็นคนละค่ากับระยะเยื้อง</p></div>
        <div className="form-grid">
          <Field label="STA หัวเจาะปัจจุบัน"><input value={currentSTA} onChange={e=>{setCurrentSTA(e.target.value);setRecovery(prev=>({...prev,initialStateConfirmed:false}));markDirty();}}/></Field>
          {[
            ['startDeviationH','เยื้องแนวราบ H (mm)'],['startDeviationV','เยื้องแนวดิ่ง V (mm)'],
            ['startHeadingErrorDeg','มุมคลาดแนวราบ (°)'],['startPitchErrorDeg','มุมคลาดแนวดิ่ง (°)'],
            ['recoveryDistanceM','ระยะเป้าหมายกลับเข้าแนว (m)'],['endpointToleranceMm','เกณฑ์ตำแหน่งปลายทาง ± (mm)'],
            ['endpointHeadingToleranceDeg','เกณฑ์มุมปลายทาง ± (°)'],
            ['maxTaperTurnDeg','เพดานมุม Taper ต่อริงแบบจำลอง (°)'],
            ['responseDiameterMm','เส้นผ่านศูนย์กลางแบบจำลอง Taper (mm)'],
          ].map(([key,label])=><Field key={key} label={label}><input type="number" step="any" value={recovery[key]} onChange={e=>{setRecovery(prev=>({...prev,[key]:e.target.value,...(key.startsWith('start')?{initialStateConfirmed:false}:{})}));markDirty();}}/></Field>)}
        </div>
        <label className="section-note"><input type="checkbox" checked={recovery.initialStateConfirmed} onChange={e=>{setRecovery(prev=>({...prev,initialStateConfirmed:e.target.checked}));markDirty();}}/> ยืนยันว่าตำแหน่งและมุมตั้งต้นมาจาก Survey / Navigation ที่ STA นี้</label>
        <p className="section-note">ค่าเริ่มต้น 0 เป็นค่าตัวอย่าง · ระยะกลับเข้าแนวและเกณฑ์ปลายทางต้องกำหนดตามโครงการ · ค่าเส้นผ่านศูนย์กลาง 6300 mm และเพดาน Taper 0.55° เป็นสมมติฐานของแบบจำลองเดิม ต้องตรวจรูปทรงริงจริง เป็นคนละค่ากับ Articulation ของเครื่อง · คีย์ใช้จำลองผล Taper ไม่ใช่คำสั่งเลี้ยว TBM</p>
      </section>
      {planResult.endpoint && <InsightPanel level={needsRecalc?'unknown':planResult.verdict.status==='INFEASIBLE'?'critical':planResult.endpoint.level} title={needsRecalc?'ผลปลายทางก่อนแก้ไข — ต้องคำนวณใหม่':planResult.verdict.message}>
        <p>ปลายแนว STA {planResult.recovery.endpointSTA} · H/V คาดการณ์ {planResult.endpoint.deviationH}/{planResult.endpoint.deviationV} mm · มุมคลาด H/V {planResult.endpoint.headingErrorDeg}/{planResult.endpoint.pitchErrorDeg}°</p>
        <p>ระยะคลาดตามทิศทางแนวที่ปลายทาง {planResult.endpoint.longitudinalDeviationMm} mm (ค่าลบ = ยังไม่ถึงระนาบปลายแนวในแบบจำลอง)</p>
        <p>ตำแหน่ง {planResult.endpoint.positionPass?'อยู่ใน':'นอก'}เกณฑ์ ±{planResult.endpoint.toleranceMm} mm · ทิศทาง {planResult.endpoint.headingPass?'อยู่ใน':'นอก'}เกณฑ์ ±{planResult.endpoint.headingToleranceDeg}°</p>
        <p>ข้อมูลตั้งต้น: {planResult.recovery.initialStateConfirmed?'ผู้ใช้ยืนยันจาก Survey / Navigation':'ค่าตัวอย่าง ยังไม่ยืนยันสนาม'} · แนวดิ่ง {planResult.recovery.verticalKnown?'ครอบคลุมช่วงที่วางแผน':'ยังไม่ครบ จึงยืนยันปลายทางไม่ได้'}</p>
        <p>ระยะเหลือ {planResult.recovery.totalDistanceM} m · ระยะเป้าหมายกลับเข้าแนว {planResult.recovery.effectiveDistanceM.toFixed(1)} m</p>
        <p>จุดปลายแนวถูกตรวจที่ STA จริง{planResult.recovery.finalRingBeyondEndpointM>0?` ซึ่งอยู่ก่อนขอบริงสุดท้าย ${planResult.recovery.finalRingBeyondEndpointM} m`:''} · ผลเป็นแบบจำลอง ต้องตรวจข้อจำกัดเครื่องและค่าตรวจสนามก่อนใช้</p>
        <p>แนวดิ่งอ้างอิงระดับปลายแต่ละช่วงและประมาณโค้งด้วยพาราโบลา ไม่ใช่การนำเข้าพิกัดแนว 3D ที่สอบเทียบแล้ว</p>
      </InsightPanel>}
      <RecoveryChart planResult={planResult} onSelectStep={setScrubStep}/>
      <PlanInsight summary={summary} actions={<button className="btn btn-outline" onClick={()=>showIssues('issues')}>ตรวจริงที่มีข้อเตือน</button>}><p>ผลคาดการณ์จากแบบจำลอง · ข้อมูลสนามที่ใช้ปรับน้ำหนัก {planResult.aiWeights?.sampleSize||0} ริง · จำนวนข้อมูลไม่ใช่ความแม่นยำ</p></PlanInsight>
      <div className="stat-grid">
        <StatCard label="จำนวนริงในแผน" value={planResult.totalRings} unit="ริง"/>
        <StatCard label="Lead เกินเกณฑ์" value={summary.leadCount} unit="ริง" detail={`เกณฑ์ ±${planResult.maxTolerance||maxTolerance} mm`} onClick={()=>showIssues('lead')}/>
        <StatCard label="DTA นอกเกณฑ์" value={summary.dtaCount} unit="ริง" detail={`|Dev| สูงสุด ${summary.maxDeviation??'—'} mm`} onClick={()=>showIssues('dta')}/>
        <StatCard label="Gap เตือนหรือวิกฤต" value={summary.gapCount} unit="ริง" detail={`ต่ำสุด ${summary.minGap??'—'} mm`} onClick={()=>showIssues('gap')}/>
      </div>
      <div className="card form-grid"><Field label="วิธีเลือกคีย์"><select value={strategy} onChange={e=>{setStrategy(e.target.value);markDirty();}}><option value="senior_ai">มองล่วงหน้าและตรวจข้อจำกัด</option><option value="ratio_guided">เลือกตามสัดส่วน Ratio รายช่วง</option></select></Field><p className="section-note">Ratio เป็นสัดส่วนเป้าหมายในการจัดอันดับคีย์ · ตรวจยอดที่ทำได้จริงเทียบเป้าหมายหลังคำนวณ</p></div>
      {/* Running Ratio Summary */}
      {isCalculated && planResult.totalRings > 0 && (
        <div className="flex flex-wrap items-center gap-4 bg-surf-2 border border-white/10 rounded-2xl px-5 py-3 font-mono text-xs">
          <span className="text-text-muted font-sans font-semibold">สัดส่วนผลคาดการณ์:</span>
          <span className="text-text font-bold">{planResult.totalRings} ริง</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">UN: {planResult.counts.un} ({(planResult.counts.un / planResult.totalRings * 100).toFixed(1)}%)</span>
          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-bold">RT: {planResult.counts.rt} ({(planResult.counts.rt / planResult.totalRings * 100).toFixed(1)}%)</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold">LT: {planResult.counts.lt} ({(planResult.counts.lt / planResult.totalRings * 100).toFixed(1)}%)</span>
        </div>
      )}

      <div className="card form-grid">
        <Field label="คีย์เริ่มต้น"><select value={startKey} onChange={e=>{setStartKey(e.target.value);markDirty();}}>{Object.keys(KEY_DATA).map(k=><option key={k}>{k}</option>)}</select></Field>
        <Field label="H Lead เริ่มต้น (mm)"><input type="number" step="0.1" value={startHLead} onChange={e=>{setStartHLead(e.target.value);markDirty();}}/></Field>
        <Field label="V Lead เริ่มต้น (mm)"><input type="number" step="0.1" value={startVLead} onChange={e=>{setStartVLead(e.target.value);markDirty();}}/></Field>
        <Field label="Lead Limit ± (mm)"><input type="number" value={maxTolerance} onChange={e=>{setMaxTolerance(e.target.value);markDirty();}}/></Field>
        <Field label="เป้าหมายการเลี้ยว"><select value={steeringSign} onChange={e=>{setSteeringSign(e.target.value);markDirty();}}><option value="steering_bias">เป้าหมายตรงข้าม Lead โค้ง</option><option value="standard_positive">เป้าหมายตาม Lead โค้ง</option></select></Field>
        <div className="page-actions"><button className="btn btn-outline" onClick={handleResetSections}><RotateCcw size={16}/>ใช้ช่วงตาม Drawing</button></div>
      </div>
      {!needsRecalc && planResult.ratioDiagnostics?.some(r=>!r.matches) && <InsightPanel level="warning" title="ยอดคีย์ที่เลือกยังไม่ตรง Ratio เป้าหมาย"><p>ลำดับคีย์และเกณฑ์ตรวจอาจทำให้ยอดจริงแตกต่างจากสัดส่วน · ตรวจรายการก่อนสั่งผลิต</p>{planResult.ratioDiagnostics.filter(r=>!r.matches).map(r=><p key={r.sectionCode}>{r.sectionCode}: เป้าหมาย U/R/L {r.expected.unCount}/{r.expected.rtCount}/{r.expected.ltCount} · ได้ {r.actual.un}/{r.actual.rt}/{r.actual.lt}</p>)}</InsightPanel>}

      {/* Dynamic Alignment Section Summary & Setting Ratio Switcher */}
      <div className="bg-surf-2 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} className="text-acc" /> ข้อมูลช่วง Alignment ({sections.length} ช่วง)
              </h3>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
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
              <span className="text-xs text-text-muted">
                {sec.direction === 'right' ? 'โค้งขวา' : sec.direction === 'left' ? 'โค้งซ้าย' : 'ทางตรง'} (R={sec.radius}m)
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold flex items-center gap-1 ${
                sec.isLocked !== false
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              }`}>
                {sec.isLocked !== false ? (
                  <>
                    <Lock size={10} /> Ratio เป้าหมาย ({sec.ratio ? `${sec.ratio.un}:${sec.ratio.rt}:${sec.ratio.lt}` : '1:1:1'})
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
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <div className="field">
                    <label className="text-xs">Type</label>
                    <select
                      value={sec.sectionType}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].sectionType = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      className="bg-surf-3 border border-white/10 text-text text-xs p-1.5 rounded outline-none"
                    >
                      <option value="full_curve">Full Curve</option>
                      <option value="transition_in">Transition (In)</option>
                      <option value="transition_out">Transition (Out)</option>
                      <option value="tangent">Tangent (ตรง)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="text-xs">Direction</label>
                    <select
                      value={sec.direction}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].direction = e.target.value;
                        setSections(copy);
                        markDirty();
                      }}
                      className="bg-surf-3 border border-white/10 text-text text-xs p-1.5 rounded outline-none"
                    >
                      <option value="right">Right (ขวา)</option>
                      <option value="left">Left (ซ้าย)</option>
                      <option value="straight">Straight</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="text-xs">Radius (m)</label>
                    <input
                      type="number"
                      value={sec.radius}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx].radius = Number(e.target.value) || 0;
                        setSections(copy);
                        markDirty();
                      }}
                      className="bg-surf-3 border border-white/10 text-amber-400 font-bold text-xs p-1.5 rounded text-center outline-none"
                    />
                  </div>
                </div>

                {/* STA Inputs (Editable) & Estimated Info */}
                <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-surf-3/60 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-text-muted text-xs block">Start STA</span>
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
                    <span className="text-text-muted text-xs block">End STA</span>
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
                <div className="flex items-center justify-between text-xs font-mono text-text-muted px-1">
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
                    <div className="space-y-1.5 pt-2 border-t border-white/5 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted font-bold uppercase">
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
                    <span className="font-bold text-text-muted uppercase text-xs">
                      อัตราส่วน (UN : RT : LT)
                    </span>
                    <span className="font-mono font-bold text-acc bg-surf-3 px-2 py-0.5 rounded border border-white/5 text-xs">
                      {breakdown.ratioStr}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 font-mono">
                    <div className="bg-surf-3 p-1.5 rounded-lg border border-amber-500/30 text-center">
                      <span className="text-xs text-amber-300 font-bold block">UN (1.2m)</span>
                      <input
                        type="number"
                        min="0"
                        value={sec.ratio.un}
                        onChange={(e) => updateSectionRatio(idx, 'un', e.target.value)}
                        className="w-full bg-transparent text-amber-400 font-black text-base text-center outline-none"
                      />
                      <span className="text-xs text-text-muted block">{breakdown.unCount} ริง ({breakdown.unPct}%)</span>
                    </div>

                    <div className="bg-surf-3 p-1.5 rounded-lg border border-rose-500/30 text-center">
                      <span className="text-xs text-rose-300 font-bold block">RT (1.4m)</span>
                      <input
                        type="number"
                        min="0"
                        value={sec.ratio.rt}
                        onChange={(e) => updateSectionRatio(idx, 'rt', e.target.value)}
                        className="w-full bg-transparent text-rose-400 font-black text-base text-center outline-none"
                      />
                      <span className="text-xs text-text-muted block">{breakdown.rtCount} ริง ({breakdown.rtPct}%)</span>
                    </div>

                    <div className="bg-surf-3 p-1.5 rounded-lg border border-cyan-500/30 text-center">
                      <span className="text-xs text-cyan-300 font-bold block">LT (1.4m)</span>
                      <input
                        type="number"
                        min="0"
                        value={sec.ratio.lt}
                        onChange={(e) => updateSectionRatio(idx, 'lt', e.target.value)}
                        className="w-full bg-transparent text-cyan-400 font-black text-base text-center outline-none"
                      />
                      <span className="text-xs text-text-muted block">{breakdown.ltCount} ริง ({breakdown.ltPct}%)</span>
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1 font-mono text-xs pt-0.5">
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
                    className="w-full mt-2 py-1.5 rounded bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/30 hover:bg-purple-500/30 flex justify-center items-center gap-1.5 transition-all"
                  >
                    <Sparkles size={13} /> เปรียบเทียบและแนะนำ Ratio
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('2d_map')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeSubTab === '2d_map'
                  ? 'bg-acc text-black shadow-md shadow-cyan-400/20'
                  : 'bg-surf-3 text-text-muted hover:text-white'
              }`}
            >
              <Eye size={16} /> แผนภาพแนวอุโมงค์
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
              <TrendingUp size={16} /> กราฟ Lead
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
              <Layers size={16} /> ตารางริง ({planResult.plannedRings.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={needsRecalc || !planResult.plannedRings.length}
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
            <LeadChart rings={planResult.plannedRings} limit={planResult.maxTolerance} theme={theme} onSelect={r=>setScrubStep(r.step)}/>
          </div>
        )}

        {/* View 3: Sequence Schedule Table */}
        {activeSubTab === 'table' && (<div><div className="tab-strip">{[['all','ทุกริง'],['issues','ต้องตรวจทาน'],['lead','Lead'],['dta','DTA'],['gap','Gap']].map(([value,label])=><button key={value} aria-pressed={resultFilter===value} onClick={()=>setResultFilter(value)}>{label}</button>)}</div>
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
                  <th className="p-2.5">DTA H</th>
                  <th className="p-2.5">DTA V</th>
                  <th className="p-2.5">มุมคลาด H/V</th>
                  <th className="p-2.5">Tail Gap (L/R)</th>
                  <th className="p-2.5">Risk Score</th>
                  <th className="p-2.5">💡 AI Reasoning (เหตุผลการตัดสินใจ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tableRings.map((r) => {
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
                      <td className="p-2.5 font-bold text-acc"><button className="underline" onClick={()=>{setScrubStep(r.step);setActiveSubTab('2d_map');}}>{r.ringNum}</button></td>
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
                        <span className="text-xs text-text-muted ml-1">({r.sizeM}m)</span>
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
                      <td className="p-2.5">{r.deviationVMm} mm</td>
                      <td className="p-2.5">{r.headingErrorDeg}/{r.pitchErrorDeg}°</td>
                      <td className="p-2.5 font-mono text-xs">
                        <span className={r.gapL < 15 ? 'text-amber-400 font-bold' : 'text-text-muted'}>L:{r.gapL}</span> /{' '}
                        <span className={r.gapR < 15 ? 'text-amber-400 font-bold' : 'text-text-muted'}>R:{r.gapR}</span>
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded border text-xs font-bold ${riskColor}`}>
                          {r.riskIndex}<span className="text-xs opacity-70">/100</span>
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
          </div></div>
        )}
      </div>
      {selectedRing && <div className="two-columns"><InsightPanel level={assessRing(selectedRing,{...getLimits(gapSettings),lead:planResult.maxTolerance}).level} title={`${track} · ${selectedRing.ringNum} · ${selectedRing.selectedKey} · STA ${selectedRing.sta}`}><p>{selectedRing.aiReasoning}</p><p>After H/V {selectedRing.afterH}/{selectedRing.afterV} mm · DTA H/V {selectedRing.deviationMm}/{selectedRing.deviationVMm} mm · มุมคลาด {selectedRing.headingErrorDeg}/{selectedRing.pitchErrorDeg}°</p></InsightPanel><GapVisualizer gapT={selectedRing.gapT} gapB={selectedRing.gapB} gapL={selectedRing.gapL} gapR={selectedRing.gapR} warnThreshold={gapSettings.warnThreshold} blockThreshold={gapSettings.criticalThreshold}/></div>}
    </div>
  );
}

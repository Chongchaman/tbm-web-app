import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LayoutDashboard, Calculator, Sparkles, Compass, Map as MapIcon, Layers, History, Database, Droplets, HardHat, Building2, Menu, X, Cloud, Sun, Moon, Settings2, Download, BookOpen } from 'lucide-react';
const AdvancePlannerView = lazy(() => import('./views/AdvancePlannerView'));
const TunnelPositionView = lazy(() => import('./views/TunnelPositionView'));
const SoilProfileView = lazy(() => import('./views/SoilProfileView'));
const AutoPlannerView = lazy(() => import('./views/AutoPlannerView'));
const PlannerView = lazy(() => import('./views/PlannerView'));
const DashboardView = lazy(() => import('./views/DashboardView'));
const HistoryLogView = lazy(() => import('./views/HistoryLogView'));
const ConsumablesView = lazy(() => import('./views/ConsumablesView'));
const MasterDataView = lazy(() => import('./views/MasterDataView'));
const GuideView = lazy(() => import('./views/GuideView'));
import ErrorBoundary from './components/ErrorBoundary';
import GoogleSheetsModal from './components/GoogleSheetsModal';
import AppearanceSettings from './components/AppearanceSettings';
import { normalizeAppearance, appearanceTokens } from './services/appearance';
import { INITIAL_RING_LOGS } from './data/tbmConstants';
import { flushPendingRecords, isSheetsConnected, pendingCount, queueRecordChanges, setProjectItem } from './services/googleSheetsService';
import { readStored, recordKind, ringNumber, validateRing } from './services/decisionSupport';
import { recordIdentity as identity } from './services/recordIdentity';
import { tbmMode } from './services/tbmMode';

const menus = [
  { id:'advanceplanner', label:'วางแผนแนวอุโมงค์', icon:Compass, group:'วางแผนและตรวจค่า' },
  { id:'position', label:'ภาพตำแหน่งหัวเจาะ', icon:MapIcon },
  { id:'soil', label:'ข้อมูลชั้นดิน', icon:Layers },
  { id:'planning', label:'คำนวณริงเดี่ยว', icon:Calculator },
  { id:'autoplanner', label:'วางแผนต่อเนื่อง', icon:Sparkles },
  { id:'dashboard', label:'ภาพรวมโครงการ', icon:LayoutDashboard, group:'ติดตามและจัดการ' },
  { id:'history', label:'ประวัติและข้อมูลสนาม', icon:History },
  { id:'consumables', label:'สารปรับปรุงดิน', icon:Droplets },
  { id:'masterdata', label:'ข้อมูลแนวและสัดส่วน', icon:Database },
  { id:'guide', label:'คู่มือการใช้งาน', icon:BookOpen },
];
const sortRings = rings => [...rings].sort((a,b) => ringNumber(a)-ringNumber(b));
const canonical = ring => ({ ...ring, track:ring.track==='WB'?'WB':'EB', ringNum:`R${String(ringNumber(ring)).padStart(4,'0')}`, ringNumber:ringNumber(ring), recordType:recordKind(ring) });

export default function AppShell() {
  const [activeTab,setActiveTab] = useState('advanceplanner');
  const [advanceTrack,setAdvanceTrack] = useState(() => readStored('tbm_advance_track','EB') === 'WB' ? 'WB' : 'EB');
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [cloudModal,setCloudModal] = useState(false);
  const [preferences,setPreferences] = useState(false);
  const [connected,setConnected] = useState(isSheetsConnected);
  const [cloudState,setCloudState] = useState('local');
  const [notice,setNotice] = useState(null);
  const [historyFilter,setHistoryFilter] = useState('all');
  const [appearance,setAppearance] = useState(() => normalizeAppearance(readStored('tbm_appearance',{
    theme:readStored('tbm_theme','light'),fontFamily:readStored('tbm_ui_font','sarabun'),fontSize:readStored('tbm_ui_size','md'),density:readStored('tbm_density','comfortable'),
  })));
  const { theme,fontFamily,fontSize,density }=appearance;
  const BrandIcon={hardhat:HardHat,compass:Compass,building:Building2}[appearance.brandIcon];
  const [ringLogs,setRingLogs] = useState(() => {
    const saved = readStored('tbm_ring_logs',INITIAL_RING_LOGS);
    return sortRings((Array.isArray(saved) ? saved : INITIAL_RING_LOGS).filter(r => recordKind(r)!=='planned').map(canonical));
  });
  const [plans,setPlans] = useState(() => {
    const saved = readStored('tbm_saved_plans',[]);
    const legacy = readStored('tbm_ring_logs',[]);
    const migrated = Array.isArray(legacy) ? legacy.filter(r=>recordKind(r)==='planned') : [];
    return sortRings([...new Map([...(Array.isArray(saved)?saved:[]),...migrated].map(r=>{const plan=canonical({...r,recordType:'planned'});return [identity(plan),plan];})).values()]);
  });
  const busy = useRef(false);
  const logsRef = useRef(ringLogs);
  const backupMade = useRef(false);
  useEffect(()=>{ logsRef.current=ringLogs; },[ringLogs]);

  useEffect(()=>{
    const values={theme,fontFamily,fontSize,density};
    const keys={theme:'tbm_theme',fontFamily:'tbm_ui_font',fontSize:'tbm_ui_size',density:'tbm_density'};
    Object.entries(values).forEach(([key,value])=>{
      document.documentElement.setAttribute(`data-${key==='fontFamily'?'font-family':key==='fontSize'?'font-size':key}`,value);
      try { setProjectItem(keys[key],JSON.stringify(value)); } catch { /* preferences remain available for this session */ }
    });
    Object.entries(appearanceTokens(appearance)).forEach(([key,value])=>document.documentElement.style.setProperty(key,value));
    document.title=`${appearance.appName} — ${appearance.projectName}`;
    try {setProjectItem('tbm_appearance',JSON.stringify(appearance));} catch { /* settings remain available for this session */ }
  },[appearance,theme,fontFamily,fontSize,density]);

  const saveAppearance=value=>{
    setProjectItem('tbm_appearance',JSON.stringify(value));
    setAppearance(value);
    setNotice({level:'normal',text:'บันทึกชื่อโครงการและหน้าตาในเบราว์เซอร์นี้แล้ว'});
  };

  useEffect(()=>{
    try {
      if(!backupMade.current) {
        const original=localStorage.getItem('tbm_ring_logs');
        if(original && !localStorage.getItem('tbm_ring_logs_before_smart_ui')) setProjectItem('tbm_ring_logs_before_smart_ui',original);
        backupMade.current=true;
      }
      // Write the separated plans first so migration is recoverable if storage is full.
      setProjectItem('tbm_saved_plans',JSON.stringify(plans));
      setProjectItem('tbm_ring_logs',JSON.stringify(ringLogs));
    } catch { queueMicrotask(()=>setNotice({level:'critical',text:'พื้นที่บันทึกในเครื่องไม่พอ กรุณาสำรองข้อมูลก่อนปิดหน้า'})); }
  },[ringLogs,plans]);

  const navigate=(tab,filter='all')=>{setActiveTab(tab);setHistoryFilter(filter);setSidebarOpen(false);window.scrollTo({top:0,behavior:'instant'});};
  const changeAdvanceTrack=value=>{if(!['EB','WB'].includes(value))return;setAdvanceTrack(value);try{setProjectItem('tbm_advance_track',JSON.stringify(value));}catch{/* current session remains usable */}};
  async function writeRecords(records, existing=null) {
    if(busy.current) throw new Error('กำลังบันทึกข้อมูล กรุณารอสักครู่');
    busy.current=true;
    try {
      const normalized=records.map(canonical);
      const errors=normalized.flatMap(r=>validateRing(r));
      if(errors.length) throw new Error(errors.join(' · '));
      if(new Set(normalized.map(identity)).size!==normalized.length) throw new Error('มีหมายเลขริงซ้ำในรายการที่บันทึก');
      const fieldRecords=normalized.filter(r=>recordKind(r)!=='planned');
      if(fieldRecords.some(next=>logsRef.current.some(old=>ringNumber(old)===ringNumber(next) && old.track===next.track && old!==existing && identity(old)!==identity(existing||{})))) throw new Error('หมายเลขริงของเครื่องนี้มีอยู่แล้ว กรุณาแก้ไขรายการเดิมในประวัติ');
      if(existing && (ringNumber(existing)!==ringNumber(normalized[0]) || (existing.track||'EB')!==normalized[0].track)) throw new Error('แก้หมายเลขริงหรือเครื่องเจาะไม่ได้ กรุณาเพิ่มรายการใหม่');
      const nextPlans=normalized.filter(r=>recordKind(r)==='planned');
      queueRecordChanges(normalized,'save');
      if(nextPlans.length) setPlans(prev=>sortRings([...prev.filter(old=>!nextPlans.some(next=>identity(next)===identity(old))),...nextPlans]));
      if(fieldRecords.length) setRingLogs(prev=>sortRings([...prev.filter(old=>!fieldRecords.some(next=>identity(next)===identity(old))),...fieldRecords]));
      if(existing && recordKind(existing)==='planned' && fieldRecords.length) setPlans(prev=>prev.filter(r=>identity(r)!==identity(existing)));
      if(connected && localStorage.getItem('tbm_google_sheets_migrated')==='1') {
        try { await flushPendingRecords(); setCloudState('live'); setNotice({level:'normal',text:`บันทึก ${normalized.length} รายการในเครื่องและ Google Sheet แล้ว`}); }
        catch(error) {setCloudState('error');setNotice({level:'warning',text:`บันทึกในเครื่องแล้ว · รอส่งไป Google Sheet (${error.message})`});}
      } else setNotice({level:'normal',text:`บันทึก ${normalized.length} รายการในเครื่องแล้ว · รอเชื่อมต่อ Google Sheet`});
    } catch(error) {setNotice({level:'critical',text:error.message});throw error;} finally {busy.current=false;}
  }
  async function removeRecords(records) {
    if(busy.current) throw new Error('กำลังบันทึกข้อมูล กรุณารอ');
    busy.current=true;
    try {
      queueRecordChanges(records,'delete');
      const ids=new Set(records.map(identity));
      setRingLogs(prev=>prev.filter(r=>!ids.has(identity(r)))); setPlans(prev=>prev.filter(r=>!ids.has(identity(r))));
      if(connected && localStorage.getItem('tbm_google_sheets_migrated')==='1') {
        try { await flushPendingRecords(); setCloudState('live'); setNotice({level:'normal',text:`ลบ ${records.length} รายการในเครื่องและ Google Sheet แล้ว`}); }
        catch(error) {setCloudState('error');setNotice({level:'warning',text:`ลบในเครื่องแล้ว · รอส่งไป Google Sheet (${error.message})`});}
      } else setNotice({level:'normal',text:`ลบ ${records.length} รายการในเครื่องแล้ว · รอเชื่อมต่อ Google Sheet`});
    } catch(error) {setNotice({level:'critical',text:`ลบไม่สำเร็จ: ${error.message}`});throw error;} finally {busy.current=false;}
  }
  const backup=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:4,exportedAt:new Date().toISOString(),ringLogs,plans,appearance,horizontal:readStored('tbm_horizontal_alignment',[]),vertical:readStored('tbm_vertical_alignment',[]),horizontalEB:readStored('tbm_horizontal_alignment_EB',[]),horizontalWB:readStored('tbm_horizontal_alignment_WB',[]),verticalEB:readStored('tbm_vertical_alignment_EB',[]),verticalWB:readStored('tbm_vertical_alignment_WB',[]),gapSettings:readStored('tbm_gap_settings',{}),advanceTrack,advanceEB:readStored('tbm_advance_session_EB',{}),advanceWB:readStored('tbm_advance_session_WB',{}),singleEB:readStored('tbm_single_session_EB',{}),singleWB:readStored('tbm_single_session_WB',{}),singleTypesEB:readStored('tbm_single_types_EB',[]),singleTypesWB:readStored('tbm_single_types_WB',[]),sequenceEB:readStored('tbm_sequence_session_EB',{}),sequenceWB:readStored('tbm_sequence_session_WB',{}),sequenceTypesEB:readStored('tbm_sequence_types_EB',[]),sequenceTypesWB:readStored('tbm_sequence_types_WB',[]),soilLevels:readStored('tbm_soil_levels',{}),soilLevelStations:readStored('tbm_soil_level_stations',{})},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`tbm-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const active=menus.find(m=>m.id===activeTab);
  const latestField=track=>ringLogs.filter(r=>r.track===track&&recordKind(r)==='measured').sort((a,b)=>ringNumber(a)-ringNumber(b)).at(-1);
  const leadRing=latestField('EB');
  const followRing=latestField('WB');
  const activePlans=plans.filter(r=>r.track===advanceTrack);
  return <ErrorBoundary><a className="skip-link" href="#main-content">ข้ามไปเนื้อหา</a><div className="app-shell">
    {sidebarOpen && <button className="sidebar-overlay" aria-label="ปิดเมนู" onClick={()=>setSidebarOpen(false)} />}
    <aside className={`app-sidebar ${sidebarOpen?'is-open':''}`}><div className="brand"><div className="brand-icon"><BrandIcon size={24}/></div><div><strong>{appearance.appName}</strong><small>{appearance.projectName}</small><small>{appearance.projectDetail}</small></div></div><nav aria-label="เมนูหลัก">{menus.map(({id,label,icon:Icon,group})=><div key={id}>{group && <span className="nav-group">{group}</span>}<button className={`nav-item ${activeTab===id?'active':''}`} aria-current={activeTab===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={19}/><span>{label}</span>{id==='history' && <small>{ringLogs.filter(r=>r.track===advanceTrack).length+activePlans.length}</small>}</button></div>)}</nav><div className="sidebar-footer"><button className="nav-item" onClick={()=>{setSidebarOpen(false);setPreferences(true);}}><Settings2 size={19}/><span>ตั้งค่าโครงการและหน้าตา</span></button><button className="nav-item" onClick={()=>setCloudModal(true)}><Cloud size={19}/><span>Google Sheets<small style={{display:'block'}}>{!connected?`ข้อมูลในเครื่อง · รอส่ง ${pendingCount()}`:cloudState==='error'?`เชื่อมต่อมีปัญหา · รอส่ง ${pendingCount()}`:`เชื่อมต่อแล้ว · รอส่ง ${pendingCount()}`}</small></span></button><button className="nav-item" onClick={backup}><Download size={19}/><span>สำรองข้อมูล</span></button></div></aside>
    <div className="app-main"><header className="app-topbar"><div className="topbar-title"><button className="icon-button mobile-menu" aria-label="เปิดเมนู" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu size={20}/></button><span>{active.label}</span><span className="source-label topbar-project" title={appearance.projectName}>/ {appearance.projectName}</span></div><div className="topbar-actions">{activeTab!=='guide'&&<div className="topbar-tbm-switch" role="group" aria-label="เลือกเครื่องเจาะ">{['EB','WB'].map(value=><button key={value} aria-pressed={advanceTrack===value} onClick={()=>changeAdvanceTrack(value)}>{tbmMode(value).machine}<small>{value}</small></button>)}</div>}<button className="icon-button" aria-label={theme==='light'?'ใช้ธีมมืด':'ใช้ธีมสว่าง'} onClick={()=>setAppearance(previous=>({...previous,theme:theme==='light'?'dark':'light'}))}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><button className="icon-button" aria-label="ตั้งค่าโครงการและหน้าตา" title="ตั้งค่าโครงการและหน้าตา" onClick={()=>setPreferences(true)}><Settings2 size={18}/></button></div></header>
    <main className="app-content" id="main-content">
      {activeTab!=='guide' && <div className="machine-context"><div><strong>{advanceTrack==='EB'?'TBM1 · E/B · หัวนำ':'TBM2 · W/B · หัวตาม'}</strong><span>แผนที่บันทึก {activePlans.length} ริง · ข้อมูลและแนวของเครื่องนี้</span></div><div className="machine-progress"><span>TBM1 · {plans.filter(r=>r.track==='EB').length} แผน · {leadRing?.ringNum||'ยังไม่มีค่าจริง'}</span><span>TBM2 · {plans.filter(r=>r.track==='WB').length} แผน · {followRing?.ringNum||'ยังไม่มีค่าจริง'}</span>{leadRing&&followRing&&<b>ต่างกัน {Math.abs(ringNumber(leadRing)-ringNumber(followRing))} ริง</b>}</div></div>}
      {notice && <div className={`notice-toast status-${notice.level}`} role="status"><span>{notice.text}</span><button className="icon-button" aria-label="ปิดข้อความ" onClick={()=>setNotice(null)}><X size={16}/></button></div>}
      <Suspense fallback={<div className="empty-state" role="status">กำลังเปิดหน้าจอ…</div>}>
      {activeTab==='advanceplanner' && <AdvancePlannerView key={advanceTrack} track={advanceTrack} onTrackChange={changeAdvanceTrack} ringLogs={ringLogs} onBatchSave={records=>writeRecords(records.map(r=>({...r,recordType:'planned'})))} onNavigate={navigate} theme={theme}/>}
      {activeTab==='position' && <TunnelPositionView key={advanceTrack} track={advanceTrack} onTrackChange={changeAdvanceTrack} onNavigate={navigate}/>}
      {activeTab==='soil' && <SoilProfileView key={advanceTrack} track={advanceTrack} onTrackChange={changeAdvanceTrack} onNavigate={navigate}/>}
      {activeTab==='planning' && <PlannerView key={advanceTrack} track={advanceTrack} ringLogs={ringLogs.filter(r=>r.track===advanceTrack)} onSaveRing={record=>writeRecords([{...record,track:advanceTrack,recordType:'planned'}])} theme={theme}/>}
      {activeTab==='autoplanner' && <AutoPlannerView key={advanceTrack} track={advanceTrack} ringLogs={ringLogs.filter(r=>r.track===advanceTrack)} onBatchSave={records=>writeRecords(records.map(r=>({...r,track:advanceTrack,recordType:'planned'})))} theme={theme}/>}
      {activeTab==='dashboard' && <DashboardView key={advanceTrack} ringLogs={ringLogs.filter(r=>r.track===advanceTrack)} plans={activePlans} onNavigate={navigate} theme={theme}/>}
      {activeTab==='history' && <HistoryLogView key={advanceTrack} track={advanceTrack} ringLogs={sortRings([...ringLogs,...plans].filter(r=>r.track===advanceTrack))} initialFilter={historyFilter} onUpdateRing={(existing,record)=>writeRecords([record],existing)} onAddRing={record=>writeRecords([record])} onBatchDelete={removeRecords}/>}
      {activeTab==='consumables' && <ConsumablesView key={advanceTrack} ringLogs={ringLogs.filter(r=>r.track===advanceTrack)}/>}
      {activeTab==='masterdata' && <MasterDataView key={advanceTrack} track={advanceTrack} onNavigate={navigate}/> }
      {activeTab==='guide' && <GuideView onNavigate={navigate}/>}
      </Suspense>
    </main></div></div>
    {preferences && <AppearanceSettings settings={appearance} onSave={saveAppearance} onClose={()=>setPreferences(false)} />}
    {cloudModal && <GoogleSheetsModal onClose={()=>setCloudModal(false)} ringLogs={ringLogs} plans={plans} onConnectionChange={value=>{setConnected(value);setCloudState(value?'live':'local');setNotice(null);}}/>}
  </ErrorBoundary>;
}

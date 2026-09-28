import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LayoutDashboard, Calculator, Sparkles, Compass, History, Database, Droplets, HardHat, Menu, X, Cloud, Sun, Moon, Settings2, Download } from 'lucide-react';
const AdvancePlannerView = lazy(() => import('./views/AdvancePlannerView'));
const AutoPlannerView = lazy(() => import('./views/AutoPlannerView'));
const PlannerView = lazy(() => import('./views/PlannerView'));
const DashboardView = lazy(() => import('./views/DashboardView'));
const HistoryLogView = lazy(() => import('./views/HistoryLogView'));
const ConsumablesView = lazy(() => import('./views/ConsumablesView'));
const MasterDataView = lazy(() => import('./views/MasterDataView'));
import ErrorBoundary from './components/ErrorBoundary';
import SupabaseModal from './components/SupabaseModal';
import { Field, StatusBadge, Dialog } from './components/PlannerUI';
import { INITIAL_RING_LOGS } from './data/tbmConstants';
import { isSupabaseConfigured } from './services/supabaseClient';
import { fetchRingLogsFromCloud, batchSaveRingLogsToCloud, batchDeleteRingLogsFromCloud, subscribeToRealtimeRings } from './services/supabaseService';
import { readStored, recordKind, ringNumber, validateRing } from './services/decisionSupport';

const menus = [
  { id:'advanceplanner', label:'วางแผนแนวอุโมงค์', icon:Compass, group:'วางแผนและตรวจค่า' },
  { id:'planning', label:'คำนวณริงเดี่ยว', icon:Calculator },
  { id:'autoplanner', label:'วางแผนต่อเนื่อง', icon:Sparkles },
  { id:'dashboard', label:'ภาพรวมโครงการ', icon:LayoutDashboard, group:'ติดตามและจัดการ' },
  { id:'history', label:'ประวัติและข้อมูลสนาม', icon:History },
  { id:'consumables', label:'สารปรับปรุงดิน', icon:Droplets },
  { id:'masterdata', label:'ข้อมูลแนวและสัดส่วน', icon:Database },
];
const sortRings = rings => [...rings].sort((a,b) => ringNumber(a)-ringNumber(b));
const identity = ring => `${recordKind(ring)}:${ringNumber(ring)}`;
const canonical = ring => ({ ...ring, ringNum:`R${String(ringNumber(ring)).padStart(4,'0')}`, ringNumber:ringNumber(ring), recordType:recordKind(ring) });

export default function AppShell() {
  const [activeTab,setActiveTab] = useState('advanceplanner');
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [cloudModal,setCloudModal] = useState(false);
  const [preferences,setPreferences] = useState(false);
  const [configured,setConfigured] = useState(isSupabaseConfigured);
  const [cloudState,setCloudState] = useState('local');
  const [notice,setNotice] = useState(null);
  const [historyFilter,setHistoryFilter] = useState('all');
  const [theme,setTheme] = useState(() => readStored('tbm_theme','light'));
  const [fontFamily,setFontFamily] = useState(() => readStored('tbm_ui_font','sarabun'));
  const [fontSize,setFontSize] = useState(() => readStored('tbm_ui_size','md'));
  const [density,setDensity] = useState(() => readStored('tbm_density','comfortable'));
  const [ringLogs,setRingLogs] = useState(() => {
    const saved = readStored('tbm_ring_logs',INITIAL_RING_LOGS);
    return sortRings((Array.isArray(saved) ? saved : INITIAL_RING_LOGS).filter(r => recordKind(r)!=='planned').map(canonical));
  });
  const [plans,setPlans] = useState(() => {
    const saved = readStored('tbm_saved_plans',[]);
    const legacy = readStored('tbm_ring_logs',[]);
    const migrated = Array.isArray(legacy) ? legacy.filter(r=>recordKind(r)==='planned') : [];
    return sortRings([...new Map([...(Array.isArray(saved)?saved:[]),...migrated].map(r=>[ringNumber(r),canonical({...r,recordType:'planned'})])).values()]);
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
      try { localStorage.setItem(keys[key],JSON.stringify(value)); } catch { /* preferences remain available for this session */ }
    });
  },[theme,fontFamily,fontSize,density]);

  useEffect(()=>{
    try {
      if(!backupMade.current) {
        const original=localStorage.getItem('tbm_ring_logs');
        if(original && !localStorage.getItem('tbm_ring_logs_before_smart_ui')) localStorage.setItem('tbm_ring_logs_before_smart_ui',original);
        backupMade.current=true;
      }
      // Write the separated plans first so migration is recoverable if storage is full.
      localStorage.setItem('tbm_saved_plans',JSON.stringify(plans));
      localStorage.setItem('tbm_ring_logs',JSON.stringify(ringLogs));
    } catch { queueMicrotask(()=>setNotice({level:'critical',text:'พื้นที่บันทึกในเครื่องไม่พอ กรุณาสำรองข้อมูลก่อนปิดหน้า'})); }
  },[ringLogs,plans]);

  useEffect(()=>{
    if(!configured) return;
    let active=true;
    const changed=new Set();
    const upsert = ring => {
      if(!active) return;
      const next=canonical(ring); changed.add(ringNumber(next));
      if(recordKind(next)==='planned') setPlans(prev=>sortRings([...prev.filter(r=>ringNumber(r)!==ringNumber(next)),next]));
      else setRingLogs(prev=>sortRings([...prev.filter(r=>ringNumber(r)!==ringNumber(next)),next]));
    };
    const stop=subscribeToRealtimeRings(upsert,upsert,num=>{
      if(!active) return; changed.add(num);
      setRingLogs(prev=>prev.filter(r=>ringNumber(r)!==num));
    },status=>{if(active && status!=='SUBSCRIBED') setCloudState(status==='CHANNEL_ERROR'||status==='TIMED_OUT'?'error':'checking');else if(active) setCloudState('live');});
    fetchRingLogsFromCloud().then(res=>{
      if(!active) return;
      if(res.error) {setCloudState('error');setNotice({level:'warning',text:`อ่าน Cloud ไม่สำเร็จ: ${res.error} · ข้อมูลในเครื่องยังอยู่`});return;}
      const remote=(res.data||[]).map(canonical);
      const remoteNumbers=new Set(remote.filter(r=>recordKind(r)!=='planned').map(ringNumber));
      setRingLogs(prev=>sortRings([...prev.filter(r=>!remoteNumbers.has(ringNumber(r)) || changed.has(ringNumber(r))),...remote.filter(r=>recordKind(r)!=='planned' && !changed.has(ringNumber(r)))]));
      setPlans(prev=>sortRings([...new Map([...remote.filter(r=>recordKind(r)==='planned'),...prev].map(r=>[ringNumber(r),r])).values()]));
      setCloudState(previous=>previous==='live'?'live':'loaded');
    });
    return ()=>{active=false;stop?.();};
  },[configured]);

  const navigate=(tab,filter='all')=>{setActiveTab(tab);setHistoryFilter(filter);setSidebarOpen(false);window.scrollTo({top:0,behavior:'instant'});};
  async function writeRecords(records, existing=null) {
    if(busy.current) throw new Error('กำลังบันทึกข้อมูล กรุณารอสักครู่');
    busy.current=true;
    try {
      const normalized=records.map(canonical);
      const errors=normalized.flatMap(r=>validateRing(r));
      if(errors.length) throw new Error(errors.join(' · '));
      if(new Set(normalized.map(identity)).size!==normalized.length) throw new Error('มีหมายเลขริงซ้ำในรายการที่บันทึก');
      const fieldRecords=normalized.filter(r=>recordKind(r)!=='planned');
      if(fieldRecords.some(next=>logsRef.current.some(old=>ringNumber(old)===ringNumber(next) && old!==existing && identity(old)!==identity(existing||{})))) throw new Error('หมายเลขริงมีอยู่แล้ว กรุณาแก้ไขรายการเดิมในประวัติ');
      if(existing && ringNumber(existing)!==ringNumber(normalized[0])) throw new Error('แก้หมายเลขริงไม่ได้ กรุณาเพิ่มรายการใหม่');
      if(configured && fieldRecords.length) {
        const res=await batchSaveRingLogsToCloud(fieldRecords);
        if(res.error) {setCloudState('error');throw new Error(`Cloud ไม่ยืนยันการบันทึก: ${res.error}`);}
      }
      const nextPlans=normalized.filter(r=>recordKind(r)==='planned');
      if(nextPlans.length) setPlans(prev=>sortRings([...prev.filter(old=>!nextPlans.some(next=>ringNumber(next)===ringNumber(old))),...nextPlans]));
      if(fieldRecords.length) setRingLogs(prev=>sortRings([...prev.filter(old=>!fieldRecords.some(next=>ringNumber(next)===ringNumber(old))),...fieldRecords]));
      if(existing && recordKind(existing)==='planned' && fieldRecords.length) setPlans(prev=>prev.filter(r=>ringNumber(r)!==ringNumber(existing)));
      setNotice({level:'normal',text:nextPlans.length?`บันทึกแผนคาดการณ์ ${nextPlans.length} ริงในเครื่องแล้ว · แยกจากข้อมูลสนาม`:`บันทึก ${fieldRecords.length} รายการ${configured?' และ Cloud ยืนยันแล้ว':'ในเครื่องแล้ว'}`});
    } catch(error) {setNotice({level:'critical',text:error.message});throw error;} finally {busy.current=false;}
  }
  async function removeRecords(records) {
    if(busy.current) throw new Error('กำลังบันทึกข้อมูล กรุณารอ');
    busy.current=true;
    try {
      const fieldRecords=records.filter(r=>recordKind(r)!=='planned');
      if(configured && fieldRecords.length) {const res=await batchDeleteRingLogsFromCloud(fieldRecords.map(ringNumber));if(res.error) throw new Error(res.error);}
      const ids=new Set(records.map(identity));
      setRingLogs(prev=>prev.filter(r=>!ids.has(identity(r)))); setPlans(prev=>prev.filter(r=>!ids.has(identity(r))));
      setNotice({level:'normal',text:`ลบ ${records.length} รายการแล้ว`});
    } catch(error) {setNotice({level:'critical',text:`ลบไม่สำเร็จ: ${error.message}`});throw error;} finally {busy.current=false;}
  }
  const backup=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),ringLogs,plans,horizontal:readStored('tbm_horizontal_alignment',[]),vertical:readStored('tbm_vertical_alignment',[]),gapSettings:readStored('tbm_gap_settings',{})},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`tbm-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const active=menus.find(m=>m.id===activeTab);
  return <ErrorBoundary><a className="skip-link" href="#main-content">ข้ามไปเนื้อหา</a><div className="app-shell">
    {sidebarOpen && <button className="sidebar-overlay" aria-label="ปิดเมนู" onClick={()=>setSidebarOpen(false)} />}
    <aside className={`app-sidebar ${sidebarOpen?'is-open':''}`}><div className="brand"><div className="brand-icon"><HardHat size={24}/></div><div><strong>TBM PLANNER</strong><small>MWA-9D · TBM #34</small></div></div><nav aria-label="เมนูหลัก">{menus.map(({id,label,icon:Icon,group})=><div key={id}>{group && <span className="nav-group">{group}</span>}<button className={`nav-item ${activeTab===id?'active':''}`} aria-current={activeTab===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={19}/><span>{label}</span>{id==='history' && <small>{ringLogs.length+plans.length}</small>}</button></div>)}</nav><div className="sidebar-footer"><button className="nav-item" onClick={()=>setCloudModal(true)}><Cloud size={19}/><span>ฐานข้อมูล Cloud<small style={{display:'block'}}>{!configured?'ใช้ข้อมูลในเครื่อง':cloudState==='live'?'Realtime เชื่อมต่อแล้ว':cloudState==='loaded'?'อ่าน Cloud แล้ว · รอ Realtime':cloudState==='error'?'เชื่อมต่อมีปัญหา':'กำลังตรวจการเชื่อมต่อ'}</small></span></button><button className="nav-item" onClick={backup}><Download size={19}/><span>สำรองข้อมูล</span></button></div></aside>
    <div className="app-main"><header className="app-topbar"><div className="topbar-title"><button className="icon-button mobile-menu" aria-label="เปิดเมนู" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu size={20}/></button><span>{active.label}</span><span className="source-label topbar-project">/ MRT Purple Line</span></div><div className="topbar-actions"><button className="icon-button" aria-label={theme==='light'?'ใช้ธีมมืด':'ใช้ธีมสว่าง'} onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><button className="icon-button" aria-label="ตั้งค่าการแสดงผล" onClick={()=>setPreferences(true)}><Settings2 size={18}/></button></div></header>
    <main className="app-content" id="main-content">
      {notice && <div className={`notice-toast status-${notice.level}`} role="status"><span>{notice.text}</span><button className="icon-button" aria-label="ปิดข้อความ" onClick={()=>setNotice(null)}><X size={16}/></button></div>}
      <Suspense fallback={<div className="empty-state" role="status">กำลังเปิดหน้าจอ…</div>}>
      {activeTab==='advanceplanner' && <AdvancePlannerView ringLogs={ringLogs} onBatchSave={records=>writeRecords(records.map(r=>({...r,recordType:'planned'})))} onNavigate={navigate} theme={theme}/>}
      {activeTab==='planning' && <PlannerView ringLogs={ringLogs} onSaveRing={record=>writeRecords([{...record,recordType:'planned'}])} theme={theme}/>}
      {activeTab==='autoplanner' && <AutoPlannerView ringLogs={ringLogs} onBatchSave={records=>writeRecords(records.map(r=>({...r,recordType:'planned'})))} theme={theme}/>}
      {activeTab==='dashboard' && <DashboardView ringLogs={ringLogs} plans={plans} onNavigate={navigate} theme={theme}/>}
      {activeTab==='history' && <HistoryLogView ringLogs={sortRings([...ringLogs,...plans])} initialFilter={historyFilter} onUpdateRing={(existing,record)=>writeRecords([record],existing)} onAddRing={record=>writeRecords([record])} onBatchDelete={removeRecords}/>}
      {activeTab==='consumables' && <ConsumablesView ringLogs={ringLogs}/>}
      {activeTab==='masterdata' && <MasterDataView onNavigate={navigate}/> }
      </Suspense>
    </main></div></div>
    {preferences && <div className="dialog-backdrop" onClick={()=>setPreferences(false)}><Dialog className="dialog preferences-dialog" label="ตั้งค่าการแสดงผล" onClose={()=>setPreferences(false)} onClick={e=>e.stopPropagation()}><div className="section-heading"><h2>ตั้งค่าการแสดงผล</h2><button className="icon-button" autoFocus aria-label="ปิดการตั้งค่า" onClick={()=>setPreferences(false)}><X size={18}/></button></div><div className="stack"><Field label="ฟอนต์"><select value={fontFamily} onChange={e=>setFontFamily(e.target.value)}>{[['sarabun','Sarabun'],['prompt','Prompt'],['noto','Noto Sans Thai'],['kanit','Kanit'],['chakra','Chakra Petch'],['mitr','Mitr']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field><Field label="ขนาดข้อความ"><select value={fontSize} onChange={e=>setFontSize(e.target.value)}>{[['sm','กระชับ'],['md','มาตรฐาน'],['lg','ใหญ่'],['xl','ใหญ่พิเศษ']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field><Field label="ระยะห่าง"><select value={density} onChange={e=>setDensity(e.target.value)}><option value="comfortable">อ่านสบาย</option><option value="compact">กระชับ</option></select></Field></div><StatusBadge level="normal">จำค่าการแสดงผลในเครื่องนี้</StatusBadge></Dialog></div>}
    {cloudModal && <SupabaseModal isOpen={cloudModal} onClose={()=>setCloudModal(false)} ringLogs={ringLogs} onSyncRingLogs={records=>{setRingLogs(previous=>sortRings([...new Map([...previous,...records.filter(r=>recordKind(r)!=='planned').map(canonical)].map(r=>[ringNumber(r),r])).values()]));setPlans(previous=>sortRings([...new Map([...previous,...records.filter(r=>recordKind(r)==='planned').map(canonical)].map(r=>[ringNumber(r),r])).values()]));}} onConnectionChange={value=>{setConfigured(value);setCloudState(value?'checking':'local');}}/>}
  </ErrorBoundary>;
}

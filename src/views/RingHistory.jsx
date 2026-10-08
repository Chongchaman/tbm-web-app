import { useState } from 'react';
import { Download, Plus, Edit3, Trash2, X } from 'lucide-react';
import { PageHeader, Field, StatCard, InsightPanel, StatusBadge, ValidationErrors, EmptyState, Dialog } from '../components/PlannerUI';
import GapVisualizer from '../components/GapVisualizer';
import { KEY_DATA } from '../data/tbmConstants';
import { assessRing, summarizeRings, recordKind, RECORD_LABELS, ringNumber, nextRingNumber, validateRing, finite, readStored, getLimits, exportCSV } from '../services/decisionSupport';
import { recordIdentity as id } from '../services/recordIdentity';

export default function RingHistory({ringLogs=[],initialFilter='all',onUpdateRing=async()=>{},onAddRing=async()=>{},onBatchDelete=async()=>{}}) {
  const [search,setSearch]=useState('');
  const [source,setSource]=useState(RECORD_LABELS[initialFilter.split(':')[0]]?initialFilter.split(':')[0]:'all');
  const [status,setStatus]=useState(initialFilter==='issues'||initialFilter.endsWith(':issues')?'issues':'all');
  const [type,setType]=useState('all');
  const [sort,setSort]=useState('newest');
  const [page,setPage]=useState(1);
  const [selection,setSelection]=useState(new Set());
  const [inspected,setInspected]=useState(null);
  const [editor,setEditor]=useState(null);
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [deleteMode,setDeleteMode]=useState('selected');
  const [range,setRange]=useState({start:'',end:''});
  const [pin,setPin]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const limits=getLimits(readStored('tbm_gap_settings',{}));
  const summary=summarizeRings(ringLogs,limits);
  const query=search.trim().toLowerCase();
  const filtered=ringLogs.filter(r=>(source==='all'||recordKind(r)===source)&&(type==='all'||r.key?.[0]===type)&&(status==='all'||assessRing(r,limits).level!=='normal')&&[r.ringNum,r.key,r.notes,r.sta,r.track].some(v=>String(v||'').toLowerCase().includes(query))).sort((a,b)=>sort==='newest'?ringNumber(b)-ringNumber(a):ringNumber(a)-ringNumber(b));
  const pages=Math.max(1,Math.ceil(filtered.length/25)),currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*25,currentPage*25);
  const checked=selection.size?ringLogs.filter(r=>selection.has(id(r))):[];
  const active=ringLogs.find(r=>id(r)===inspected);
  const filter=(setter,value)=>{setter(value);setPage(1);};
  const toggle=ring=>setSelection(prev=>{const next=new Set(prev);next.has(id(ring))?next.delete(id(ring)):next.add(id(ring));return next;});
  const selectPage=()=>setSelection(prev=>{const next=new Set(prev),all=visible.every(r=>next.has(id(r)));visible.forEach(r=>all?next.delete(id(r)):next.add(id(r)));return next;});
  const openEditor=(ring=null,asMeasured=false)=>{
    setError('');
    const planned=ring&&recordKind(ring)==='planned';
    const form=ring?{...ring,recordType:asMeasured?'measured':recordKind(ring)}:{ringNum:nextRingNumber(ringLogs.filter(r=>recordKind(r)!=='planned')),key:'L2',recordType:'measured',hLead:'',vLead:'',gapT:'',gapB:'',gapL:'',gapR:'',roll:0,pitch:0,deviationMm:'',notes:''};
    if(planned&&asMeasured) Object.assign(form,{hLead:'',vLead:'',gapT:'',gapB:'',gapL:'',gapR:'',deviationMm:'',notes:`ค่าตรวจสนาม · แผนคีย์เดิม ${ring.key}`});
    setEditor({existing:ring,form,confirmed:false});
  };
  const changeEditor=(key,value)=>setEditor(prev=>{
    const form={...prev.form,[key]:value};
    if(key==='recordType' && prev.form.recordType==='planned' && value==='measured') Object.assign(form,{hLead:'',vLead:'',gapT:'',gapB:'',gapL:'',gapR:'',deviationMm:''});
    return {...prev,form,confirmed:key==='recordType'?false:prev.confirmed};
  });
  const editorErrors=editor?validateRing(editor.form):[];
  const saveEditor=async()=>{
    if(busy||!editor)return;
    if(editorErrors.length){setError(editorErrors.join(' · '));return;}
    if(editor.form.recordType==='measured'&&!editor.confirmed){setError('ยืนยันว่าค่าในฟอร์มเป็นค่าที่ตรวจวัดสนามก่อนบันทึก');return;}
    setBusy(true);setError('');
    const numeric=['hLead','vLead','gapT','gapB','gapL','gapR','roll','pitch'];
    const record={...editor.form,...Object.fromEntries(numeric.map(k=>[k,Number(editor.form[k]||0)])),deviationMm:finite(editor.form.deviationMm)?Number(editor.form.deviationMm):null,timestamp:editor.existing&&recordKind(editor.existing)===editor.form.recordType?editor.existing.timestamp:new Date().toISOString()};
    // An edited measurement is assessed from its measured values, not from a stale forecast.
    delete record.afterH;delete record.afterV;
    try{if(editor.existing)await onUpdateRing(editor.existing,record);else await onAddRing(record);setEditor(null);}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const rangeValid=/^R?\d+$/i.test(range.start)&&/^R?\d+$/i.test(range.end);
  const start=ringNumber({ringNum:range.start}),end=ringNumber({ringNum:range.end});
  const toDelete=deleteMode==='all'?ringLogs:deleteMode==='range'?(rangeValid?ringLogs.filter(r=>ringNumber(r)>=Math.min(start,end)&&ringNumber(r)<=Math.max(start,end)):[]):checked;
  const deleteRecords=async()=>{
    if(pin!=='1234'){setError('รหัส PIN ไม่ถูกต้อง');return;}
    if(!toDelete.length){setError('ไม่มีรายการที่จะลบ ตรวจรายการหรือช่วงริง');return;}
    setBusy(true);setError('');try{await onBatchDelete(toDelete);setSelection(new Set());setDeleteOpen(false);setPin('');}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const exportRows=()=>exportCSV('tbm-ring-history.csv',['Source','Tunnel','Ring','Key','H Lead (mm)','V Lead (mm)','DTA (mm)','Gap T','Gap B','Gap L','Gap R','Roll','Timestamp','Notes'],filtered.map(r=>[RECORD_LABELS[recordKind(r)],r.track||'',r.ringNum,r.key,r.hLead,r.vLead,r.deviationMm,r.gapT,r.gapB,r.gapL,r.gapR,r.roll,r.timestamp,r.notes]));
  const openDelete=()=>{setDeleteMode(checked.length?'selected':'range');setPin('');setError('');setDeleteOpen(true);};
  return <div className="stack"><PageHeader eyebrow="History · Data quality" title="ประวัติ แผน และค่าตรวจสนาม" description="ค้นหา กรองจุดที่ต้องตรวจ แก้ไขข้อมูลตามหมายเลขริง และแยกแหล่งข้อมูลก่อนนำไปวิเคราะห์" actions={<><button className="btn btn-outline" onClick={exportRows}><Download size={16}/>Export ที่กรองอยู่</button><button className="btn btn-acc" onClick={()=>openEditor()}><Plus size={16}/>เพิ่มค่าตรวจสนาม</button></>}/>
    <div className="stat-grid"><StatCard label="รายการทั้งหมด" value={ringLogs.length} unit="รายการ"/><StatCard label="รายการที่ต้องตรวจค่า" value={summary.problemCount} unit="รายการ" onClick={()=>filter(setStatus,'issues')}/><StatCard label="ยังไม่ระบุแหล่งข้อมูล" value={ringLogs.filter(r=>recordKind(r)==='legacy').length} unit="รายการ" onClick={()=>filter(setSource,'legacy')}/></div>
    {ringLogs.some(r=>recordKind(r)==='legacy') && <InsightPanel level="unknown" title="ตรวจแหล่งข้อมูลของรายการเก่า"><p>รายการเดิมยังไม่ถูกนับเป็นค่าตรวจสนามอัตโนมัติ เปิดแก้ไขเพื่อระบุแหล่งข้อมูลและยืนยันค่าที่ตรวจจริง</p></InsightPanel>}
    <div className="history-toolbar"><Field label="ค้นหาริง คีย์ STA หรือหมายเหตุ"><input type="search" placeholder="เช่น R0016 หรือ L2" value={search} onChange={e=>filter(setSearch,e.target.value)}/></Field><Field label="แหล่งข้อมูล"><select value={source} onChange={e=>filter(setSource,e.target.value)}><option value="all">ทั้งหมด</option>{Object.entries(RECORD_LABELS).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></Field><Field label="ผลตรวจ"><select value={status} onChange={e=>filter(setStatus,e.target.value)}><option value="all">ทั้งหมด</option><option value="issues">เฉพาะที่ต้องตรวจ</option></select></Field><Field label="ชนิดเซ็กเมนต์"><select value={type} onChange={e=>filter(setType,e.target.value)}><option value="all">ทุกชนิด</option><option value="U">UN</option><option value="R">RT</option><option value="L">LT</option></select></Field></div>
    <div className="section-heading"><span className="section-note">พบ {filtered.length} รายการ · เลือก {checked.length} รายการ{checked.length?' (รวมที่อยู่นอกตัวกรอง)':''}</span><div className="page-actions"><select className="field-control" aria-label="ลำดับประวัติ" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">ริงใหม่ก่อน</option><option value="oldest">ริงเก่าก่อน</option></select><button className="btn btn-danger" onClick={openDelete}><Trash2 size={16}/>ลบรายการด้วย PIN</button></div></div>
    {filtered.length?<><div className="data-table-wrap"><table className="data-table"><thead><tr><th><input type="checkbox" aria-label="เลือกทุกแถวในหน้านี้" checked={visible.length>0&&visible.every(r=>selection.has(id(r)))} onChange={selectPage}/></th><th>ริง / แหล่งข้อมูล</th><th>คีย์</th><th className="numeric">H Lead (mm)</th><th className="numeric">V Lead (mm)</th><th className="numeric">DTA (mm)</th><th className="numeric">Gap ต่ำสุด (mm)</th><th>ผลตรวจ</th><th>จัดการ</th></tr></thead><tbody>{visible.map(r=>{const assessment=assessRing(r,limits);return <tr key={id(r)} className={inspected===id(r)?'selected-row':''}><td><input type="checkbox" aria-label={`เลือก ${r.ringNum} ${RECORD_LABELS[recordKind(r)]}`} checked={selection.has(id(r))} onChange={()=>toggle(r)}/></td><td><button className="row-button" onClick={()=>setInspected(id(r))}>{r.ringNum}</button><span className="source-label block">{RECORD_LABELS[recordKind(r)]} {r.track?`· ${r.track}`:''}</span></td><td>{r.key}</td><td className="numeric">{finite(r.hLead)?r.hLead:'—'}</td><td className="numeric">{finite(r.vLead)?r.vLead:'—'}</td><td className="numeric">{finite(r.deviationMm)?r.deviationMm:'—'}</td><td className="numeric">{assessment.minGap??'—'}</td><td><StatusBadge level={assessment.level}/></td><td><div className="page-actions"><button className="icon-button" aria-label={`แก้ไข ${r.ringNum} ${RECORD_LABELS[recordKind(r)]}`} onClick={()=>openEditor(r)}><Edit3 size={16}/></button>{recordKind(r)==='planned'&&<button className="btn btn-outline" onClick={()=>openEditor(r,true)}>กรอกค่าจริง</button>}</div></td></tr>;})}</tbody></table></div><div className="pagination"><span className="section-note">หน้า {currentPage}/{pages} · หน้าละ 25 รายการ</span><div className="page-actions"><button className="btn btn-outline" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>ก่อนหน้า</button><button className="btn btn-outline" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>ถัดไป</button></div></div></>:<EmptyState title="ไม่มีรายการตามตัวกรองนี้">เปลี่ยนตัวกรองหรือเพิ่มค่าตรวจสนาม</EmptyState>}
    {active&&<div className="two-columns"><div className="card"><div className="section-heading"><h3>{active.track ? `${active.track} · ` : ''}{active.ringNum} · {active.key}</h3><StatusBadge level={assessRing(active,limits).level}/></div><p className="source-label">{RECORD_LABELS[recordKind(active)]} · {active.timestamp||'ไม่มีวันเวลา'}</p><p className="mt-3" style={{overflowWrap:'anywhere'}}>{active.notes||'ไม่มีหมายเหตุ'}</p>{assessRing(active,limits).issues.map(issue=><p className="section-note mt-2" key={issue.code}>{issue.message}</p>)}</div><GapVisualizer gapT={active.gapT} gapB={active.gapB} gapL={active.gapL} gapR={active.gapR} source={RECORD_LABELS[recordKind(active)]} warnThreshold={limits.gapWarning} blockThreshold={limits.gapCritical}/></div>}
    {editor&&<div className="dialog-backdrop"><Dialog label="แก้ไขข้อมูลริง" busy={busy} onClose={()=>setEditor(null)}><div className="section-heading"><h2>{editor.existing?'ตรวจและแก้ไขข้อมูลริง':'เพิ่มค่าตรวจสนาม'}</h2><button className="icon-button" aria-label="ปิดแก้ไข" disabled={busy} onClick={()=>setEditor(null)}><X size={18}/></button></div><div className="form-grid"><Field label="หมายเลขริง"><input autoFocus value={editor.form.ringNum} readOnly={Boolean(editor.existing)} onChange={e=>changeEditor('ringNum',e.target.value)}/></Field><Field label="คีย์"><select value={editor.form.key} onChange={e=>changeEditor('key',e.target.value)}>{Object.keys(KEY_DATA).map(k=><option key={k}>{k}</option>)}</select></Field><Field label="แหล่งข้อมูล"><select value={editor.form.recordType} onChange={e=>changeEditor('recordType',e.target.value)}>{Object.entries(RECORD_LABELS).filter(([kind])=>kind!=='planned'||!editor.existing||recordKind(editor.existing)==='planned').map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></Field>{[['hLead','H Lead (mm)'],['vLead','V Lead (mm)'],['gapT','Gap บน (mm)'],['gapB','Gap ล่าง (mm)'],['gapL','Gap ซ้าย (mm)'],['gapR','Gap ขวา (mm)'],['roll','Roll (°)'],['pitch','Pitch (°)'],['deviationMm','DTA deviation (mm) · ถ้ามี']].map(([key,label])=><Field label={label} key={key}><input type="number" step=".01" min={key.startsWith('gap')?0:undefined} value={editor.form[key]??''} onChange={e=>changeEditor(key,e.target.value)}/></Field>)}</div><Field label="หมายเหตุ"><textarea rows={2} value={editor.form.notes||''} onChange={e=>changeEditor('notes',e.target.value)}/></Field>{editor.form.recordType==='measured'&&<label className="flex gap-3 items-start mt-4"><input type="checkbox" checked={editor.confirmed} onChange={e=>setEditor(prev=>({...prev,confirmed:e.target.checked}))}/><span>ยืนยันว่าค่า H/V Lead และ Gap เป็นค่าที่ตรวจวัดสนามจริง</span></label>}<ValidationErrors errors={[...editorErrors,...(error?[error]:[])]}/><div className="page-actions"><button className="btn btn-outline" disabled={busy} onClick={()=>setEditor(null)}>ยกเลิก</button><button className="btn btn-acc" disabled={busy||editorErrors.length>0} onClick={saveEditor}>{busy?'กำลังบันทึก…':'บันทึกข้อมูล'}</button></div></Dialog></div>}
    {deleteOpen&&<div className="dialog-backdrop"><Dialog className="dialog preferences-dialog" label="ยืนยันการลบประวัติ" busy={busy} onClose={()=>setDeleteOpen(false)}><div className="section-heading"><h2>ลบข้อมูลที่เลือก</h2><button className="icon-button" aria-label="ปิดการลบ" disabled={busy} onClick={()=>setDeleteOpen(false)}><X size={18}/></button></div><Field label="ขอบเขตการลบ"><select value={deleteMode} onChange={e=>setDeleteMode(e.target.value)}><option value="selected">รายการที่เลือก ({checked.length})</option><option value="range">ช่วงหมายเลขริง</option><option value="all">ทุกรายการ ({ringLogs.length})</option></select></Field>{deleteMode==='range'&&<div className="form-grid mt-4"><Field label="ริงเริ่ม"><input value={range.start} placeholder="R0016" onChange={e=>setRange(prev=>({...prev,start:e.target.value}))}/></Field><Field label="ริงสิ้นสุด"><input value={range.end} placeholder="R0020" onChange={e=>setRange(prev=>({...prev,end:e.target.value}))}/></Field></div>}<InsightPanel level="warning" title={`จะลบ ${toDelete.length} รายการ`}><p>รวมทั้งแผนและค่าตรวจสนามในขอบเขตที่เลือก · ข้อมูลสนามที่เชื่อม Cloud จะถูกลบจาก Cloud ด้วย</p></InsightPanel><Field label="PIN ยืนยัน"><input type="password" inputMode="numeric" autoFocus value={pin} onChange={e=>setPin(e.target.value)}/></Field><ValidationErrors errors={error?[error]:[]}/><div className="page-actions"><button className="btn btn-outline" disabled={busy} onClick={()=>setDeleteOpen(false)}>ยกเลิก</button><button className="btn btn-danger" disabled={busy||!toDelete.length} onClick={deleteRecords}>{busy?'กำลังลบ…':`ยืนยันลบ ${toDelete.length} รายการ`}</button></div></Dialog></div>}
  </div>;
}

import { setProjectItem } from '../services/cloudDatabaseService';
import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { PageHeader, Field, InsightPanel, StatusBadge, ValidationErrors, EmptyState } from '../components/PlannerUI';
import RingDiagram from '../components/RingDiagram';
import GapVisualizer from '../components/GapVisualizer';
import { KEY_DATA } from '../data/tbmConstants';
import { DEFAULT_GAP_SETTINGS, normalizeGapSettings } from '../services/advancePlanner';
import { evaluateCandidates } from '../services/smartCandidates';
import { latestMeasured, nextRingNumber, recordKind, RECORD_LABELS, readStored, finite, diagnoseOvality } from '../services/decisionSupport';

const EMPTY_GAPS = { gapT: '', gapB: '', gapL: '', gapR: '' };
const hasAllGaps = g => g && ['gapT', 'gapB', 'gapL', 'gapR'].every(k => finite(g[k]));

export default function SingleRingPlanner({ ringLogs=[],onSaveRing=async()=>{},track='EB' }) {
  const baseline=latestMeasured(ringLogs)||ringLogs.at(-1);
  const [form,setForm]=useState(()=>{
    const fallback={ringNum:nextRingNumber(ringLogs),beforeKey:baseline?.key||'R13',h:baseline?.hLead??0,v:baseline?.vLead??0,alignment:'straight',radius:500,targetH:0,targetV:0,roll:0,custom:false,curveH:0,curveV:0,notes:'',ignoreSuitability:false,beforeGap:{...EMPTY_GAPS},afterGap:{...EMPTY_GAPS}};
    const stored=readStored(`tbm_single_session_${track}`,fallback);
    return {...fallback,...stored,beforeGap:{...EMPTY_GAPS,...(stored?.beforeGap||{})},afterGap:{...EMPTY_GAPS,...(stored?.afterGap||{})}};
  });
  const [selected,setSelected]=useState(null);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [filter,setFilter]=useState('all');
  const [allowedTypes,setAllowedTypes]=useState(()=>readStored(`tbm_single_types_${track}`,['U','R','L']));
  useEffect(()=>{try{setProjectItem(`tbm_single_session_${track}`,JSON.stringify(form));setProjectItem(`tbm_single_types_${track}`,JSON.stringify(allowedTypes));}catch{/* plan remains in memory */}},[track,form,allowedTypes]);
  const [gapSettings]=useState(()=>normalizeGapSettings(readStored('tbm_gap_settings',DEFAULT_GAP_SETTINGS)));
  const update=(key,value)=>{setForm(prev=>({...prev,[key]:value}));setMessage('');};
  const updateGap=(stage,side,value)=>{setForm(prev=>({...prev,[stage]:{...(prev[stage]||EMPTY_GAPS),[side]:value}}));setMessage('');};

  const errors=[];
  if(!allowedTypes.length) errors.push('เลือกเปิด Segment อย่างน้อย 1 ชนิด: U, R หรือ L');
  if(!/^R?\d+$/i.test(String(form.ringNum))||Number(String(form.ringNum).replace(/^R/i,''))<1)errors.push('หมายเลขริงต้องเป็น R ตามด้วยจำนวนเต็มมากกว่า 0');
  if(!finite(form.h)||!finite(form.v)||!finite(form.targetH)||!finite(form.targetV)||!finite(form.roll)) errors.push('Lead, เป้าหมายและ Roll ต้องเป็นตัวเลข');
  if(!form.custom && form.alignment!=='straight' && (!finite(form.radius)||Number(form.radius)<=0)) errors.push('รัศมีโค้งต้องมากกว่า 0 m');
  if(form.custom && (!finite(form.curveH)||!finite(form.curveV))) errors.push('Curve offset ที่กำหนดเองต้องเป็นตัวเลข');

  const afterReady=hasAllGaps(form.afterGap);
  const beforeReady=hasAllGaps(form.beforeGap);
  const activeBaseGaps=afterReady?form.afterGap:beforeReady?form.beforeGap:null;
  const baseGapSource=afterReady?'หลังประกอบจริง':beforeReady?'ก่อนประกอบจริง':`ค่ามาตรฐาน ${gapSettings.initialGapTop} mm`;
  const measuredOvality=activeBaseGaps?diagnoseOvality({...activeBaseGaps,nominal:gapSettings.initialGapTop,lowWarn:gapSettings.warnThreshold,highWarn:gapSettings.highWarnThreshold}):null;

  const candidates=errors.length?[]:evaluateCandidates({beforeKey:form.beforeKey,beforeHLead:form.h,beforeVLead:form.v,targetH:form.targetH,targetV:form.targetV,alignmentType:form.custom?undefined:form.alignment,radius:form.radius,curveHLead:form.custom?form.curveH:0,curveVLead:form.custom?form.curveV:0,gapSettings,baseGaps:activeBaseGaps,ignoreSuitability:Boolean(form.ignoreSuitability),allowedTypes});
  const active=candidates.find(c=>c.key===selected)||candidates[0];
  const visible=filter==='all'?candidates:candidates.filter(c=>c.assessment.level!=='critical');

  const save=async()=>{
    if(!active || saving) return;
    setSaving(true);setMessage('');
    try {await onSaveRing({ringNum:form.ringNum,track,key:active.key,hLead:active.afterHLead,vLead:active.afterVLead,gapT:active.gapT,gapB:active.gapB,gapL:active.gapL,gapR:active.gapR,roll:Number(form.roll),pitch:0,recordType:'planned',suitability:active.suitability,timestamp:new Date().toISOString(),notes:`Planned with Before Key ${form.beforeKey} · Allowed Segment ${['U','R','L'].filter(type=>allowedTypes.includes(type)).join('/')}${form.ignoreSuitability?' · Temp Ring (Ignore Yes/No)':''} · ${active.reason}${form.notes?' · '+form.notes:''}`});setMessage(`บันทึกแผน ${form.ringNum} แล้ว เปิดประวัติเพื่อกรอกค่าตรวจสนาม`);} catch(error){setMessage(error.message);} finally {setSaving(false);}
  };
  const useNext=()=>{
    if(!active)return;
    setForm(prev=>({
      ...prev,
      beforeKey:active.key,
      h:active.afterHLead,
      v:active.afterVLead,
      ringNum:nextRingNumber([{ringNum:prev.ringNum}]),
      beforeGap:{gapT:active.gapT,gapB:active.gapB,gapL:active.gapL,gapR:active.gapR},
      afterGap:{...EMPTY_GAPS},
    }));
    setSelected(null);
  };

  return <div className="stack"><PageHeader eyebrow={`Single ring · ${track==='EB'?'TBM1':'TBM2'} · Decision support`} title={`เลือกคีย์และตรวจค่าริงเดี่ยว ${track==='EB'?'TBM1 (EB)':'TBM2 (WB)'}`} description="จัดอันดับจาก Suitability, Lead, Gap คาดการณ์ และทางเลือกของริงถัดไป พร้อมเหตุผลที่ตรวจสอบได้" actions={<button className="btn btn-outline" onClick={()=>{if(!baseline)return;setForm(prev=>({...prev,beforeKey:baseline.key,h:baseline.hLead,v:baseline.vLead,ringNum:nextRingNumber(ringLogs)}));setSelected(null);}}><RotateCcw size={16}/>ใช้ข้อมูลอ้างอิงล่าสุด</button>}/>
    <div className="workspace-grid"><section className="stack"><div className="card"><div className="section-heading"><h3>ข้อมูลก่อนวางริง</h3><span className="source-label">{baseline?RECORD_LABELS[recordKind(baseline)]:'ยังไม่มีข้อมูลสนาม'}</span></div><div className="form-grid">
      <Field label="หมายเลขริง"><input value={form.ringNum} onChange={e=>update('ringNum',e.target.value)}/></Field>
      <Field label="คีย์ก่อนหน้า"><select value={form.beforeKey} onChange={e=>{update('beforeKey',e.target.value);setSelected(null);}}>{Object.keys(KEY_DATA).map(key=><option key={key}>{key}</option>)}</select></Field>
      <Field label="H Lead ก่อนวาง (mm)"><input type="number" step=".01" value={form.h} onChange={e=>update('h',e.target.value)}/></Field>
      <Field label="V Lead ก่อนวาง (mm)"><input type="number" step=".01" value={form.v} onChange={e=>update('v',e.target.value)}/></Field>
      <Field label="แนวราบ"><select value={form.alignment} onChange={e=>update('alignment',e.target.value)}><option value="straight">ทางตรง</option><option value="right">โค้งขวา</option><option value="left">โค้งซ้าย</option></select></Field>
      <Field label="รัศมีโค้ง (m)"><input type="number" min=".01" disabled={form.alignment==='straight'||form.custom} value={form.radius} onChange={e=>update('radius',e.target.value)}/></Field>
    </div><fieldset className="segment-selector"><legend>Segment ที่เปิดใช้</legend><div className="segment-options">{[['U','UN','1.2'],['R','RT','1.4'],['L','LT','1.4']].map(([type,label,width])=><label key={type} className={`segment-option ${allowedTypes.includes(type)?'is-enabled':''}`}><input type="checkbox" aria-label={`ใช้ Segment ${type} (${label})`} checked={allowedTypes.includes(type)} onChange={event=>{setAllowedTypes(previous=>event.target.checked?[...previous,type]:previous.filter(item=>item!==type));setSelected(null);setMessage('');}}/><span><strong>{type} · {label}</strong><small>{width} m</small></span></label>)}</div><p className="section-note" role="status">{allowedTypes.length?`เปิดใช้ ${['U','R','L'].filter(type=>allowedTypes.includes(type)).join(', ')} · คำนวณใหม่ทันทีเมื่อเปลี่ยนชนิด`:'ปิดทุกชนิด — ยังไม่มีผลคำนวณ'}</p><label className="flex gap-2 items-center mt-3"><input type="checkbox" checked={Boolean(form.ignoreSuitability)} onChange={e=>{update('ignoreSuitability',e.target.checked);setSelected(null);}}/><span><strong>โหมดเทมโปริง (ไม่สนเงื่อนไข Yes/No)</strong> — เลือกได้ทุกคีย์เพื่อรื้อง่าย</span></label></fieldset></div>

    <div className="card"><div className="section-heading"><h3>ค่า Gap จริง (ก่อน / หลังประกอบ)</h3><span className="source-label">ฐานคำนวณ: {baseGapSource}</span></div>
      <p className="section-note">กรอก Gap 4 ด้าน (บน/ล่าง/ซ้าย/ขวา) เพื่อนำความไม่กลมจริง (ไข่นอน/ไข่ตั้ง) มาคิดเลือกคีย์ถัดไป (หากกรอกหลังประกอบครบ ระบบจะใช้เป็นฐานหลัก)</p>
      <div className="two-columns mt-3">
        <div><strong className="section-note">1. Gap ก่อนประกอบ (mm)</strong><div className="form-grid mt-2">{[['gapT','บน (T)'],['gapB','ล่าง (B)'],['gapL','ซ้าย (L)'],['gapR','ขวา (R)']].map(([k,lbl])=><Field key={`before-${k}`} label={lbl}><input type="number" step=".1" placeholder="40" value={form.beforeGap?.[k]??''} onChange={e=>updateGap('beforeGap',k,e.target.value)}/></Field>)}</div></div>
        <div><strong className="section-note">2. Gap หลังประกอบ (mm)</strong><div className="form-grid mt-2">{[['gapT','บน (T)'],['gapB','ล่าง (B)'],['gapL','ซ้าย (L)'],['gapR','ขวา (R)']].map(([k,lbl])=><Field key={`after-${k}`} label={lbl}><input type="number" step=".1" placeholder="40" value={form.afterGap?.[k]??''} onChange={e=>updateGap('afterGap',k,e.target.value)}/></Field>)}</div></div>
      </div>
      {measuredOvality && measuredOvality.shape!=='unknown' && <div className="mt-3"><InsightPanel level={measuredOvality.level} title={`วิเคราะห์รูปทรงจาก Gap จริง: ${measuredOvality.label}`}><p>{measuredOvality.summary}</p></InsightPanel></div>}
      {(beforeReady||afterReady) && <div className="mt-3"><button type="button" className="btn btn-outline" onClick={()=>{update('beforeGap',{...EMPTY_GAPS});update('afterGap',{...EMPTY_GAPS});}}>ล้างค่า Gap จริง (กลับไปใช้ {gapSettings.initialGapTop} mm)</button></div>}
    </div>

    <details className="advanced-options"><summary>เป้าหมายและค่าเพิ่มเติม</summary><div className="form-grid"><Field label="เป้าหมาย H (mm)"><input type="number" value={form.targetH} onChange={e=>update('targetH',e.target.value)}/></Field><Field label="เป้าหมาย V (mm)"><input type="number" value={form.targetV} onChange={e=>update('targetV',e.target.value)}/></Field><Field label="Roll สำหรับภาพวงแหวน (°)"><input type="number" step=".1" value={form.roll} onChange={e=>update('roll',e.target.value)}/></Field></div><label className="flex gap-2 my-4"><input type="checkbox" checked={form.custom} onChange={e=>update('custom',e.target.checked)}/>กำหนด Curve offset เอง</label>{form.custom && <div className="form-grid"><Field label="Curve H (mm)"><input type="number" value={form.curveH} onChange={e=>update('curveH',e.target.value)}/></Field><Field label="Curve V (mm)"><input type="number" value={form.curveV} onChange={e=>update('curveV',e.target.value)}/></Field></div>}<p className="section-note mt-3">Roll ปรับภาพวงแหวน; ตาราง Lead ใช้ค่าเรขาคณิตมาตรฐานของคีย์</p></details><ValidationErrors errors={errors}/>
    </section><section className="stack">{!active && <EmptyState title="ยังไม่มีคีย์ให้เลือก">{errors.length?'ตรวจข้อมูลและเลือกเปิด Segment อย่างน้อย 1 ชนิดก่อนคำนวณ':`ไม่มีคีย์ชนิดที่เปิดใช้ต่อจาก ${form.beforeKey} ได้ตามตาราง Transition ลองเปิดชนิดอื่นเพิ่ม หรือเปิดโหมดเทมโปริง`}</EmptyState>}{active && <><div className="card"><div className="section-heading"><h3>{active===candidates[0]?'คีย์อันดับแรก':'คีย์ที่เลือกเปรียบเทียบ'}</h3><StatusBadge level={active.assessment.level}/></div><div className="two-columns"><div><span className="selected-key">{active.key}</span><p className="section-note">{{U:'UN',R:'RT',L:'LT'}[active.type]} · {active.sizeM} m</p><dl className="detail-list"><div><dt>After H Lead</dt><dd>{active.afterHLead} mm</dd></div><div><dt>After V Lead</dt><dd>{active.afterVLead} mm</dd></div><div><dt>Curve H ที่ใช้</dt><dd>{active.leadReq} mm</dd></div><div><dt>ระยะห่างจากเป้าหมาย H/V</dt><dd>{active.drift} mm</dd></div></dl></div><RingDiagram selectedKey={active.key} beforeKey={form.beforeKey} rollDeg={form.roll} size={260}/></div></div>
      <InsightPanel level={active.assessment.level} title="เหตุผลและข้อจำกัด"><p>{active.reason}</p>{active.assessment.issues.length>0 && <ul>{active.assessment.issues.map(i=><li key={i.code}>{i.message}</li>)}</ul>}<p className="mt-2">ริงเดี่ยวไม่มีพิกัดสำรวจ จึงยังประเมิน DTA offset ไม่ได้ · ฐาน Gap: {baseGapSource}</p></InsightPanel>
      <GapVisualizer gapT={active.gapT} gapB={active.gapB} gapL={active.gapL} gapR={active.gapR} warnThreshold={gapSettings.warnThreshold} blockThreshold={gapSettings.criticalThreshold} highWarnThreshold={gapSettings.highWarnThreshold} nominal={gapSettings.initialGapTop} source={`คาดการณ์ต่อจาก${baseGapSource}`}/><div className="card"><Field label="หมายเหตุแผน"><textarea value={form.notes} rows={2} onChange={e=>update('notes',e.target.value)}/></Field><div className="page-actions mt-4"><button className="btn btn-acc" disabled={saving||errors.length>0} onClick={save}><Save size={16}/>{saving?'กำลังบันทึก…':'บันทึกเป็นแผนคาดการณ์'}</button><button className="btn btn-outline" onClick={useNext}>ใช้ผลนี้คำนวณริงถัดไป</button></div>{message && <p className="section-note mt-3" role="status">{message}</p>}</div></>}
    </section></div>
    <section><div className="section-heading"><h3>เปรียบเทียบคีย์ที่ต่อได้ · {candidates.length} ทางเลือก</h3><label className="flex gap-2 items-center section-note"><input type="checkbox" checked={filter==='reviewed'} onChange={e=>setFilter(e.target.checked?'reviewed':'all')}/>ซ่อนคีย์ที่มีข้อวิกฤต</label></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>อันดับ / คีย์</th><th>Suitability</th><th className="numeric">After H (mm)</th><th className="numeric">After V (mm)</th><th className="numeric">Gap ต่ำ / สูง (mm)</th><th>ผลตรวจ</th></tr></thead><tbody>{visible.map(c=><tr key={c.key} className={active?.key===c.key?'selected-row':''}><td><button className="row-button" onClick={()=>setSelected(c.key)}>{candidates.indexOf(c)+1}. {c.key}</button></td><td>{c.ignoreSuitability?`${c.suitability} (ข้าม)`:c.suitability}</td><td className="numeric">{c.afterHLead}</td><td className="numeric">{c.afterVLead}</td><td className="numeric">{c.assessment.minGap} / {c.assessment.maxGap}</td><td><StatusBadge level={c.assessment.level}/></td></tr>)}{!visible.length && <tr><td colSpan={6}>ไม่มีทางเลือกภายใต้ข้อมูลหรือเงื่อนไขปัจจุบัน</td></tr>}</tbody></table></div></section>
  </div>;
}

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, RotateCcw, ShieldCheck } from 'lucide-react';
import { Field, InsightPanel, PageHeader, StatCard, StatusBadge } from '../components/PlannerUI';
import { readStored } from '../services/decisionSupport';
import { setProjectItem, subscribeProjectStateChanges } from '../services/cloudDatabaseService';
import { formatSTA, SOIL_LIMITS, stationMeters } from '../services/soilProfile';
import { makePressureSections, PRESSURE_DEFAULTS, sectionAtStation, toBar } from '../services/pressureControl';

const normalizeState = value => ({
  version: 1,
  confirmed: Boolean(value?.confirmed),
  confirmedAt: value?.confirmedAt || null,
  assumptions: { ...PRESSURE_DEFAULTS, ...(value?.assumptions || {}) },
  overrides: value?.overrides && typeof value.overrides === 'object' ? value.overrides : {},
});

const pressureText = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} kPa · ${toBar(value).toFixed(2)} bar` : '—';

function PressureChart({ sections, selectedId, onSelect }) {
  const width=1080, height=300, left=68, right=28, top=24, bottom=48;
  const allValues=sections.flatMap(item=>[item.calculated.face.min,item.calculated.face.max,item.calculated.grout.min,item.calculated.grout.max]);
  const minSTA=Math.min(...sections.map(item=>item.midpoint)), maxSTA=Math.max(...sections.map(item=>item.midpoint));
  const maxPressure=Math.max(100,...allValues)*1.12;
  const x=value=>left+(value-minSTA)/Math.max(1,maxSTA-minSTA)*(width-left-right);
  const y=value=>top+(maxPressure-value)/maxPressure*(height-top-bottom);
  const points=key=>sections.map(item=>`${x(item.midpoint)},${y(key(item))}`).join(' ');
  const band=(minimum,maximum)=>`${sections.map(item=>`${x(item.midpoint)},${y(maximum(item))}`).join(' ')} ${[...sections].reverse().map(item=>`${x(item.midpoint)},${y(minimum(item))}`).join(' ')}`;
  const ticks=[0,.25,.5,.75,1].map(ratio=>maxPressure*ratio);
  return <div className="pressure-chart-scroll"><svg className="pressure-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="กราฟช่วงควบคุมแรงดันตาม STA">
    {ticks.map(value=><g key={value}><line x1={left} y1={y(value)} x2={width-right} y2={y(value)} className="pressure-grid"/><text x={left-10} y={y(value)+4} textAnchor="end">{Math.round(value)}</text></g>)}
    <polygon points={band(item=>item.calculated.face.min,item=>item.calculated.face.max)} className="pressure-face-band"/>
    <polygon points={band(item=>item.calculated.grout.min,item=>item.calculated.grout.max)} className="pressure-grout-band"/>
    <polyline points={points(item=>item.calculated.face.target)} className="pressure-face-line"/>
    <polyline points={points(item=>item.calculated.grout.target)} className="pressure-grout-line"/>
    {sections.map(item=><g key={item.id} className="pressure-chart-point" onClick={()=>onSelect(item.id)} role="button" tabIndex="0" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(item.id);}}}>
      <circle cx={x(item.midpoint)} cy={y(item.calculated.face.target)} r={selectedId===item.id?7:4}/>
      <text x={x(item.midpoint)} y={height-20} textAnchor="middle">{formatSTA(item.midpoint).replace('.000','')}</text>
    </g>)}
    <text x="18" y={height/2} transform={`rotate(-90 18 ${height/2})`} textAnchor="middle" className="pressure-axis-title">Pressure (kPa)</text>
  </svg></div>;
}

function NumericField({label,value,onChange,step='0.1',hint,min}) {
  return <Field label={label} hint={hint}><input type="number" value={value ?? ''} min={min} step={step} onChange={event=>onChange(event.target.value)}/></Field>;
}

export default function PressureControlView({track='EB'}) {
  const storageKey=`tbm_pressure_control_${track}`;
  const [state,setState]=useState(()=>normalizeState(readStored(storageKey,{})));
  useEffect(()=>subscribeProjectStateChanges(({key,value})=>{
    if(key!==storageKey || typeof value!=='string') return;
    try { setState(normalizeState(JSON.parse(value))); } catch { /* ignore malformed remote state */ }
  }),[storageKey]);
  const limit=SOIL_LIMITS[track];
  const advance=readStored(`tbm_advance_session_${track}`,{})||{};
  const initialSTA=Math.min(limit.end,Math.max(limit.start,stationMeters(advance.currentSTA)??limit.start));
  const [currentSTA,setCurrentSTA]=useState(()=>formatSTA(initialSTA));
  const sections=useMemo(()=>makePressureSections(track,state),[track,state]);
  const initialSection=sectionAtStation(sections,initialSTA)||sections[0];
  const [selectedId,setSelectedId]=useState(initialSection?.id);
  const selected=sections.find(item=>item.id===selectedId)||sections[0];
  const active=sectionAtStation(sections,stationMeters(currentSTA))||selected;
  const save=next=>{const normalized=normalizeState(next);setState(normalized);setProjectItem(storageKey,JSON.stringify(normalized));};
  const updateAssumption=(key,value)=>save({...state,confirmed:false,confirmedAt:null,assumptions:{...state.assumptions,[key]:value}});
  const updateSection=(key,value)=>save({...state,...(!key.startsWith('actual')?{confirmed:false,confirmedAt:null}:{}),overrides:{...state.overrides,[selected.id]:{...(state.overrides[selected.id]||{}),[key]:value}}});
  const confirm=()=>save({...state,confirmed:!state.confirmed,confirmedAt:!state.confirmed?new Date().toISOString():null});
  const reset=()=>save(normalizeState({}));
  const changeSTA=value=>{setCurrentSTA(value);const found=sectionAtStation(sections,stationMeters(value));if(found)setSelectedId(found.id);};
  const exportCsv=()=>{
    const headers=['Track','STA start','STA end','Drawing','Soil','Ground RL','Water RL','Axis RL','Face min kPa','Face target kPa','Face max kPa','Actual face kPa','Grout min kPa','Grout target kPa','Grout max kPa','Actual grout kPa','Confirmed'];
    const rows=sections.map(item=>[track,item.startLabel,item.endLabel,item.drawing,item.soilLabel,item.values.groundRL,item.values.waterRL,item.values.axisRL,item.calculated.face.min,item.calculated.face.target,item.calculated.face.max,item.values.actualFace??'',item.calculated.grout.min,item.calculated.grout.target,item.calculated.grout.max,item.values.actualGrout??'',state.confirmed?'Yes':'No']);
    const csv=[headers,...rows].map(row=>row.map(cell=>`"${String(cell??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`TBM-${track}-pressure-control.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const warningCount=sections.reduce((total,item)=>total+item.calculated.warnings.length,0);

  return <div className="stack pressure-page">
    <PageHeader eyebrow={`Ground loss control · ${track==='EB'?'TBM1 E/B':'TBM2 W/B'}`} title="ควบคุม Face pressure และ Tail grouting" description="กำหนดค่าเป้าหมายและช่วงยอมรับรายช่วง STA เพื่อควบคุมการสูญเสียดิน การทรุดตัว การยกตัว และแรงดันเกินที่ Tail seal หรือ Segment" actions={<><button className="btn btn-outline" onClick={exportCsv}><Download size={16}/>CSV</button><button className="btn btn-outline" onClick={reset}><RotateCcw size={16}/>คืนค่าตั้งต้น</button></>}/>

    <InsightPanel level={state.confirmed?'normal':'warning'} title={state.confirmed?'ยืนยันค่าควบคุมชุดนี้แล้ว':'ค่าที่แสดงเป็น Screening — ต้องยืนยันก่อนใช้ควบคุม TBM'} actions={<button type="button" className={state.confirmed?'btn btn-outline':'btn btn-acc'} onClick={confirm}>{state.confirmed?<><ShieldCheck size={16}/>ยกเลิกการยืนยัน</>:<><CheckCircle2 size={16}/>ยืนยันโดยวิศวกร</>}</button>}>
      <p>Ground RL อ่านโดยประมาณจาก Profile grid ส่วน GWL, Unit weight, K₀, Surcharge และขีดจำกัด Grout เป็นค่าตั้งต้น ผู้รับผิดชอบต้องตรวจ Borehole, Piezometer, Instrumentation, Method Statement และข้อจำกัดผู้ผลิตทุกครั้ง</p>
      {state.confirmedAt&&<p className="section-note">ยืนยันล่าสุด {new Date(state.confirmedAt).toLocaleString('th-TH')}</p>}
    </InsightPanel>

    <div className="pressure-control-grid card">
      <Field label="STA ที่กำลังเจาะ" hint={`${formatSTA(limit.start)} ถึง ${formatSTA(limit.end)}`}><input type="text" inputMode="decimal" value={currentSTA} onChange={event=>changeSTA(event.target.value)} placeholder="20+250.000"/></Field>
      <NumericField label="GWL ต่ำกว่าผิวดินตั้งต้น (m)" value={state.assumptions.groundwaterDepth} onChange={value=>updateAssumption('groundwaterDepth',value)} min="0"/>
      <NumericField label="Surcharge ตั้งต้น (kPa)" value={state.assumptions.surcharge} onChange={value=>updateAssumption('surcharge',value)} min="0"/>
      <NumericField label="Face safety margin (kPa)" value={state.assumptions.faceMargin} onChange={value=>updateAssumption('faceMargin',value)} min="0"/>
      <NumericField label="Face tolerance ± (kPa)" value={state.assumptions.faceTolerance} onChange={value=>updateAssumption('faceTolerance',value)} min="0"/>
      <NumericField label="Grout สูงกว่า Face (kPa)" value={state.assumptions.groutMargin} onChange={value=>updateAssumption('groutMargin',value)} min="0"/>
      <NumericField label="Grout tolerance ± (kPa)" value={state.assumptions.groutTolerance} onChange={value=>updateAssumption('groutTolerance',value)} min="0"/>
      <NumericField label="Grout maximum จากเครื่อง/แบบ (kPa)" value={state.assumptions.groutMaximum} onChange={value=>updateAssumption('groutMaximum',value)} min="0" hint="เว้นว่างไว้ ระบบจะแสดงคำเตือน"/>
      <NumericField label="ความกว้างริงสำหรับ Grout (m)" value={state.assumptions.ringWidth} onChange={value=>updateAssumption('ringWidth',value)} min="0" step="0.1"/>
      <NumericField label="Grout fill factor (%)" value={state.assumptions.groutFillFactor} onChange={value=>updateAssumption('groutFillFactor',value)} min="0" step="1" hint="ตั้งต้น 115% · ต้อง Calibrate จากปริมาตรจริง"/>
    </div>

    {active&&<div className="stat-grid">
      <StatCard label={`ช่วงปัจจุบัน · หน้าแบบ ${active.page}`} value={`${active.startLabel}–${active.endLabel}`} detail={`${active.soilLabel} · Axis RL ${Number(active.values.axisRL).toFixed(2)} m`}/>
      <StatCard label="Face pressure เป้าหมาย" value={active.calculated.face.target} unit="kPa" detail={`${active.calculated.face.min}–${active.calculated.face.max} kPa · ${toBar(active.calculated.face.target)} bar`}/>
      <StatCard label="Tail grout เป้าหมาย" value={active.calculated.grout.target} unit="kPa" detail={`${active.calculated.grout.min}–${active.calculated.grout.max} kPa · ${toBar(active.calculated.grout.target)} bar`}/>
      <StatCard label="Pore water ที่แกน" value={active.calculated.porePressure} unit="kPa" detail={`Cover ถึงแกน ${active.calculated.coverToAxis} m`}/>
      <StatCard label="Grout volume เป้าหมาย" value={active.calculated.groutVolume.target} unit="m³/ring" detail={`Tail void ${active.calculated.groutVolume.theoretical} m³ · Fill ${active.calculated.groutVolume.fillFactor}%`}/>
    </div>}

    <section className="card">
      <div className="section-heading"><div><span className="eyebrow">Pressure profile</span><h3>ช่วงควบคุมตลอดแนว {track}</h3></div><div className="pressure-legend"><span className="face">Face target / tolerance</span><span className="grout">Grout target / tolerance</span></div></div>
      <PressureChart sections={sections} selectedId={selected?.id} onSelect={setSelectedId}/>
      <p className="section-note">คลิกจุดบนกราฟหรือแถวในตารางเพื่อแก้พารามิเตอร์ของช่วงนั้น ค่าเป็นแรงดัน Gauge สำหรับวางแผนและต้องเทียบกับตำแหน่ง Pressure sensor ของเครื่อง</p>
    </section>

    {selected&&<section className="card pressure-section-editor">
      <div className="section-heading"><div><span className="eyebrow">Section {selected.index} · Drawing {selected.drawing}</span><h3>{selected.startLabel} ถึง {selected.endLabel}</h3><p className="section-note">{selected.soilLabel} · แปลจากแบบหน้า {selected.page}{selected.soilStatus==='boundary'?' · ใกล้รอยต่อชั้นดิน':''}</p></div><div className="pressure-badges"><StatusBadge level={selected.faceState.level}>{selected.faceState.label}</StatusBadge><StatusBadge level={selected.groutState.level}>{selected.groutState.label}</StatusBadge></div></div>
      <div className="form-grid pressure-editor-grid">
        <NumericField label="Ground RL (m)" value={selected.values.groundRL} onChange={value=>updateSection('groundRL',value)}/>
        <NumericField label="Groundwater RL (m)" value={selected.values.waterRL} onChange={value=>updateSection('waterRL',value)}/>
        <NumericField label="Tunnel axis RL (m)" value={selected.values.axisRL} onChange={value=>updateSection('axisRL',value)}/>
        <NumericField label="γ unsat (kN/m³)" value={selected.values.gammaUnsat} onChange={value=>updateSection('gammaUnsat',value)} min="0"/>
        <NumericField label="γ sat (kN/m³)" value={selected.values.gammaSat} onChange={value=>updateSection('gammaSat',value)} min="0"/>
        <NumericField label="K₀" value={selected.values.k0} onChange={value=>updateSection('k0',value)} step="0.01" min="0"/>
        <NumericField label="Face pressure จริง (kPa)" value={selected.values.actualFace??''} onChange={value=>updateSection('actualFace',value)} min="0"/>
        <NumericField label="Grout pressure จริง (kPa)" value={selected.values.actualGrout??''} onChange={value=>updateSection('actualGrout',value)} min="0"/>
        <NumericField label="Grout maximum เฉพาะช่วง (kPa)" value={selected.values.groutMaximum} onChange={value=>updateSection('groutMaximum',value)} min="0"/>
      </div>
      <div className="pressure-equation-summary"><div><span>Face control</span><strong>{pressureText(selected.calculated.face.min)} → {pressureText(selected.calculated.face.max)}</strong><small>Target {pressureText(selected.calculated.face.target)}</small></div><div><span>Tail grout control</span><strong>{pressureText(selected.calculated.grout.min)} → {pressureText(selected.calculated.grout.max)}</strong><small>Target {pressureText(selected.calculated.grout.target)}</small></div><div><span>แรงดันสมดุลคำนวณ</span><strong>{pressureText(selected.calculated.equilibriumPressure)}</strong><small>K₀σ′v + u</small></div></div>
      {selected.calculated.warnings.length>0&&<div className="pressure-warnings"><AlertTriangle size={18}/><ul>{selected.calculated.warnings.map(item=><li key={item}>{item}</li>)}</ul></div>}
    </section>}

    <section className="card pressure-table-card">
      <div className="section-heading"><div><h3>ตารางควบคุมรายช่วงเจาะ</h3><p className="section-note">Face ต่ำกว่าช่วงเสี่ยงดินไหลเข้าหน้าเจาะ; Grout ต่ำกว่าช่วงเสี่ยงเกิดช่องว่างท้าย Shield ส่วนค่าที่สูงเกินไปต้องตรวจ Heave, Tail seal และแรงต่อ Segment</p></div><span className="source-label">{sections.length} ช่วง · คำเตือน {warningCount}</span></div>
      <div className="data-table-wrap"><table className="pressure-table"><thead><tr><th>ช่วง STA</th><th>ชั้นดิน / ระดับ</th><th>Face min / target / max</th><th>Face จริง</th><th>Grout min / target / max</th><th>Grout จริง</th><th>สถานะ</th></tr></thead><tbody>{sections.map(item=><tr key={item.id} className={item.id===selected?.id?'selected':''} onClick={()=>setSelectedId(item.id)}><td><button type="button" className="table-link" onClick={()=>setSelectedId(item.id)}>{item.startLabel}<br/>{item.endLabel}</button><small>แบบหน้า {item.page}</small></td><td><strong>{item.soilLabel}</strong><small>GL {Number(item.values.groundRL).toFixed(1)} · Axis {Number(item.values.axisRL).toFixed(1)} m</small></td><td className="mono">{item.calculated.face.min} / <strong>{item.calculated.face.target}</strong> / {item.calculated.face.max}<small>{toBar(item.calculated.face.target)} bar</small></td><td className="mono">{item.values.actualFace!==''&&item.values.actualFace!==undefined?item.values.actualFace:'—'}</td><td className="mono">{item.calculated.grout.min} / <strong>{item.calculated.grout.target}</strong> / {item.calculated.grout.max}<small>{toBar(item.calculated.grout.target)} bar</small></td><td className="mono">{item.values.actualGrout!==''&&item.values.actualGrout!==undefined?item.values.actualGrout:'—'}</td><td><StatusBadge level={item.faceState.level}>{item.faceState.label}</StatusBadge><StatusBadge level={item.groutState.level}>{item.groutState.label}</StatusBadge></td></tr>)}</tbody></table></div>
    </section>

    <InsightPanel level="unknown" title="วิธีใช้ค่าควบคุมอย่างปลอดภัย"><ol><li>ยืนยัน Ground RL, GWL และชั้นดินจากแบบอนุมัติ Borehole และ Piezometer</li><li>ตรวจตำแหน่งและ Calibration ของ Pressure sensor เพราะค่าบน–ล่างของ Chamber ต่างกันตามความลึก</li><li>Calibrate Target/Tolerance ด้วยช่วง Trial และแนวโน้ม Settlement, Heave, Excavated volume, Screw conveyor, Grout volume และ Tail void</li><li>หยุดใช้คำแนะนำเมื่อมีชั้นดินผสม สิ่งกีดขวาง น้ำไหลผิดปกติ เครื่องหยุดนาน หรือ Instrumentation เกิน Trigger level</li></ol><p className="section-note mt-3">หลัก Screening: Face target = K₀σ′v + u + margin; Tail grout target ตั้งให้สูงกว่า Face เล็กน้อยและจำกัดด้วย Tail seal, Segment, Ground heave และ Method Statement อ้างอิง <a href="https://about.ita-aites.org/media/k2/attachments/ITAtech/ITA-AITES-Report_4-HD.pdf" target="_blank" rel="noreferrer">ITAtech Backfilling Report</a> และ <a href="https://www.fhwa.dot.gov/bridge/loadrating/pubs/hif20058.pdf" target="_blank" rel="noreferrer">FHWA Tunnel Guide</a></p></InsightPanel>
  </div>;
}

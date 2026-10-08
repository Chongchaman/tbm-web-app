import { setProjectItem } from '../services/googleSheetsService';
import { useMemo, useState } from 'react';
import { Compass, Crosshair, Layers3, Plus, Trash2 } from 'lucide-react';
import { Field, PageHeader, ValidationErrors } from '../components/PlannerUI';
import { buildAlignmentPosition } from '../services/alignmentPosition';
import { DEFAULT_RECOVERY } from '../services/alignmentRecovery';
import { DEFAULT_ALIGNMENT_SECTIONS, DEFAULT_VERTICAL_ALIGNMENT, createNewSection, createNewVerticalElement } from '../services/advancePlanner';
import { readStored } from '../services/decisionSupport';
import { soilAt, soilColumnAt, soilLevelAtStation, stationMeters } from '../services/soilProfile';
import { tbmMode } from '../services/tbmMode';

const formattedSTA = value => {
  const km = Math.floor(value / 1000);
  return `${String(km).padStart(2,'0')}+${(value % 1000).toFixed(3).padStart(7,'0')}`;
};
const line = points => points.map((point,index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
const finiteNumber = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

function TopView({ model }) {
  const { points, current, tbm } = model;
  const xs = points.map(point => point.y), ys = points.map(point => point.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(790 / Math.max(1,maxX-minX), 285 / Math.max(1,maxY-minY));
  const left = (900 - (maxX-minX)*scale)/2, top = (390 - (maxY-minY)*scale)/2;
  const map = point => ({ x:left + (point.y-minX)*scale, y:top + (point.x-minY)*scale });
  const all = points.map(map), travelled = points.filter(point => point.distance <= current.distance + 0.000001).map(map);
  const head = map(tbm), design = map(current);
  return <svg viewBox="0 0 900 390" role="img" aria-label={`Top View แนวอุโมงค์ STA ${formattedSTA(current.sta)} หัวเจาะอยู่ห่างจุดเริ่ม ${current.distance.toFixed(1)} เมตร`}>
    <defs><pattern id="top-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity=".09"/></pattern></defs>
    <rect width="900" height="390" fill="url(#top-grid)"/>
    <path d={line(all)} fill="none" stroke="var(--text-muted)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".65"/>
    <path d={line(travelled)} fill="none" stroke="var(--acc)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={all[0].x} cy={all[0].y} r="6" fill="var(--acc)"/><circle cx={all.at(-1).x} cy={all.at(-1).y} r="6" fill="var(--text-muted)"/>
    <line x1={design.x} y1={design.y} x2={head.x} y2={head.y} stroke="var(--no)" strokeWidth="2"/>
    <circle cx={design.x} cy={design.y} r="15" fill="none" stroke="var(--acc)" strokeWidth="2" strokeDasharray="4 3"/>
    <g transform={`translate(${head.x} ${head.y}) rotate(${tbm.heading*180/Math.PI})`}>
      <circle r="20" fill="var(--acc-soft)" stroke="var(--acc)" strokeWidth="2"/>
      <path d="M 13 0 L -9 -8 L -6 0 L -9 8 Z" fill="var(--acc)"/>
    </g>
    <g className="position-svg-label"><rect x={Math.max(12,Math.min(670,head.x+22))} y={Math.max(10,head.y-50)} width="212" height="39" rx="9"/>
      <text x={Math.max(22,Math.min(680,head.x+32))} y={Math.max(35,head.y-25)}>{formattedSTA(current.sta)} · หัวเจาะ</text></g>
  </svg>;
}

function LongitudinalSection({ model }) {
  const points = model.points.filter(point => point.elevation !== null);
  if (!model.verticalComplete || !points.length) return <div className="position-chart-empty">แนวดิ่งยังไม่ครอบคลุมทุก STA ของ Alignment · ตรวจช่วงแนวดิ่งด้านล่าง</div>;
  const values = points.map(point => point.elevation);
  const low = Math.min(...values)-Math.max(1,(Math.max(...values)-Math.min(...values))*.15);
  const high = Math.max(...values)+Math.max(1,(Math.max(...values)-Math.min(...values))*.15);
  const map = point => ({x:65+point.distance/model.totalDistance*790,y:300-(point.elevation-low)/(high-low)*225});
  const all = points.map(map), travelled = points.filter(point => point.distance<=model.currentDistance+0.000001).map(map);
  const design=map(model.current), head=map({...model.current,elevation:model.tbm.elevation});
  const hScale=790/model.totalDistance, vScale=225/(high-low);
  return <svg viewBox="0 0 900 350" role="img" aria-label={`รูปตัดตามยาว ระดับ Alignment ${model.current.elevation.toFixed(3)} เมตรที่ STA ${formattedSTA(model.current.sta)}`}>
    {[0,1,2,3,4].map(index => {const elevation=low+(high-low)*index/4,y=300-index*225;return <g key={index}><line x1="62" x2="858" y1={y} y2={y} stroke="var(--border)" strokeDasharray="4 6"/><text className="position-axis-label" x="8" y={y+4}>{elevation.toFixed(1)} m</text></g>;})}
    <path d={line(all)} fill="none" stroke="var(--text-muted)" strokeWidth="4" strokeLinecap="round"/>
    <path d={line(travelled)} fill="none" stroke="var(--acc)" strokeWidth="6" strokeLinecap="round"/>
    <line x1={head.x} x2={head.x} y1="55" y2="304" stroke="var(--acc)" strokeDasharray="5 5" opacity=".65"/>
    <circle cx={design.x} cy={design.y} r="9" fill="var(--surf)" stroke="var(--acc)" strokeWidth="2"/>
    <circle cx={head.x} cy={head.y} r="7" fill="var(--acc)"/>
    <text className="position-axis-label" x="65" y="332">{formattedSTA(model.startSTA)}</text>
    <text className="position-axis-label" x="730" y="332">{formattedSTA(model.endSTA)}</text>
    <text className="position-axis-label" x="505" y="25">แนวดิ่งขยาย {Math.round(vScale/hScale)}× เพื่อให้อ่านระดับได้</text>
  </svg>;
}

function SoilHeadSection({ station, track, level }) {
  const column = soilColumnAt(station,track);
  const result = soilAt(station,track,level);
  const numericLevel = finiteNumber(level) ? Number(level) : null;
  const inRange = numericLevel !== null && numericLevel >= 30 && numericLevel <= 105;
  const upper = inRange ? Math.min(105, Math.max(55, numericLevel + 12.5)) : 105;
  const lower = inRange ? upper - 25 : 30;
  const yAt = value => 23+(upper-value)/(upper-lower)*300;
  const radius = 6.3/(upper-lower)*300/2;
  const centerY = inRange ? yAt(numericLevel) : null;
  return <><svg viewBox="0 0 420 352" role="img" aria-label={inRange?`รูปตัดหน้าหัวเจาะที่ระดับ mRL ${numericLevel}, ${result.soil?.label||'อ่านชั้นดินไม่ชัด'}`:'รูปตัดชั้นดิน ต้องกรอกระดับ mRL ของหัวเจาะ'}>
    {column.slice(0,-1).map(({elevation,soil},index) => {
      const top=Math.min(elevation,upper), bottom=Math.max(elevation-5,lower);
      return top>bottom?<rect key={index} x="56" y={yAt(top)} width="310" height={yAt(bottom)-yAt(top)} fill={soil?.color||'var(--surf-3)'} opacity=".65"/>:null;
    })}
    {Array.from({length:Math.floor(upper/5)-Math.ceil(lower/5)+1},(_,index)=>Math.floor(upper/5)*5-index*5).map(elevation=><g key={elevation}>
      <line x1="52" x2="56" y1={yAt(elevation)} y2={yAt(elevation)} stroke="var(--text-muted)"/>
      <text className="position-axis-label" x="9" y={yAt(elevation)+4}>{elevation}</text></g>)}
    <rect x="56" y="23" width="310" height="300" fill="none" stroke="var(--border)"/>
    {inRange && <><line x1="48" x2="375" y1={centerY} y2={centerY} stroke="var(--acc)" strokeWidth="1.5" strokeDasharray="5 5"/>
      <circle cx="211" cy={centerY} r={radius} fill="var(--surf)" fillOpacity=".86" stroke="var(--acc)" strokeWidth="3"/>
      <circle cx="211" cy={centerY} r="3" fill="var(--acc)"/>
      <text className="position-head-label" x="228" y={centerY+4}>TBM Ø6.3 m</text></>}
    <text className="position-axis-label" x="57" y="343">สีชั้นดินโดยประมาณ · mRL +{lower.toFixed(inRange?1:0)} ถึง +{upper.toFixed(inRange?1:0)}</text>
  </svg><p className="section-note">{result.soil?`${result.soil.label} · ${result.status==='boundary'?'ใกล้รอยต่อ ต้องตรวจแบบ':'อ่านจากสีแบบเบื้องต้น'}`:'ระบุระดับ mRL เพื่อวางหัวเจาะลงบนหน้าตัดดิน'}{result.sheet?` · หน้า ${result.sheet.page}/42`:''}</p>
    <p className="section-note">หน้าตัดดินเป็นการอ่านสีแบบ Orange Line โดยประมาณ ไม่ใช่ผลเจาะสำรวจ ณ หัวเจาะจริง</p></>;
}

function OffsetZoom({ model }) {
  const bound=Math.max(100,Math.ceil(Math.max(Math.abs(model.hMm),Math.abs(model.vMm))*1.3/50)*50);
  const scale=95/bound;
  const cx=130+model.hMm*scale,cy=130-model.vMm*scale;
  return <div className="position-offset"><svg viewBox="0 0 260 260" role="img" aria-label={`ภาพขยายระยะเยื้อง H ${model.hMm} มิลลิเมตร V ${model.vMm} มิลลิเมตร`}>
    <circle cx="130" cy="130" r="95" fill="none" stroke="var(--border)" strokeDasharray="5 5"/>
    <line x1="24" x2="236" y1="130" y2="130" stroke="var(--border)"/><line x1="130" x2="130" y1="24" y2="236" stroke="var(--border)"/>
    <circle cx="130" cy="130" r="8" fill="var(--surf)" stroke="var(--text-muted)" strokeWidth="2"/>
    <line x1="130" y1="130" x2={cx} y2={cy} stroke="var(--acc)" strokeWidth="3"/>
    <circle cx={cx} cy={cy} r="9" fill="var(--acc)"/>
    <text className="position-axis-label" x="10" y="20">ขยายจุดศูนย์กลาง ±{bound} mm</text>
    <text className="position-axis-label" x="10" y="250">+H ขวา · +V ขึ้น</text>
  </svg><div><strong>เยื้อง H {model.hMm >= 0 ? '+' : ''}{model.hMm} mm</strong><strong>เยื้อง V {model.vMm >= 0 ? '+' : ''}{model.vMm} mm</strong>
    <span>วงกลมโปร่ง = แนวออกแบบ<br/>จุดทึบ = ตำแหน่งหัวเจาะ</span></div></div>;
}

export default function TunnelPositionView({ track='EB', onTrackChange=()=>{}, onNavigate=()=>{} }) {
  const mode = tbmMode(track);
  const [session,setSession] = useState(() => {
    const saved=readStored(`tbm_advance_session_${track}`,{});
    const sections=Array.isArray(saved.sections)&&saved.sections.length?saved.sections:readStored(`tbm_horizontal_alignment_${track}`,readStored('tbm_horizontal_alignment',DEFAULT_ALIGNMENT_SECTIONS));
    const vProfile=Array.isArray(saved.vProfile)&&saved.vProfile.length?saved.vProfile:readStored(`tbm_vertical_alignment_${track}`,readStored('tbm_vertical_alignment',DEFAULT_VERTICAL_ALIGNMENT));
    return {...saved,sections,vProfile,currentSTA:saved.currentSTA??sections[0]?.startSTA??'',recovery:{...DEFAULT_RECOVERY,...saved.recovery}};
  });
  const [soilLevels,setSoilLevels]=useState(()=>readStored('tbm_soil_levels',{EB:'',WB:''}));
  const [soilStations,setSoilStations]=useState(()=>readStored('tbm_soil_level_stations',{}));
  const setPlan=value=>{const next={...session,...value};setProjectItem(`tbm_advance_session_${track}`,JSON.stringify(next));setSession(next);};
  const setAlignment=value=>setPlan({...value,recovery:{...session.recovery,initialStateConfirmed:false},
    ...(value.vProfile?{verticalDatumConfirmed:false}:{})});
  const changeRecovery=(name,value)=>setPlan({recovery:{...session.recovery,[name]:value,
    ...(['startDeviationH','startDeviationV','startHeadingErrorDeg','startPitchErrorDeg'].includes(name)?{initialStateConfirmed:false}:{})}});
  const updateSection=(index,key,value)=>setAlignment({sections:session.sections.map((section,i)=>i===index?{...section,[key]:value}:section)});
  const updateVertical=(index,key,value)=>setAlignment({vProfile:session.vProfile.map((element,i)=>i===index?{...element,[key]:value}:element)});
  const addSection=()=>{const last=session.sections.at(-1),sign=Math.sign(stationMeters(last.endSTA)-stationMeters(last.startSTA))||-1;
    const next={...createNewSection('tangent','straight'),startSTA:last.endSTA,endSTA:formattedSTA(stationMeters(last.endSTA)+sign*50)};
    setAlignment({sections:[...session.sections,next]});};
  const addVertical=()=>{const last=session.vProfile.at(-1),sign=Math.sign(stationMeters(last.endSTA)-stationMeters(last.startSTA))||-1;
    const next={...createNewVerticalElement(),startSTA:last.endSTA,endSTA:formattedSTA(stationMeters(last.endSTA)+sign*50),startElev:last.endElev,endElev:last.endElev};
    setAlignment({vProfile:[...session.vProfile,next]});};
  const changeSoilLevel=value=>{const nextLevels={...soilLevels,[track]:value},nextStations={...soilStations,[track]:session.currentSTA};
    setProjectItem('tbm_soil_levels',JSON.stringify(nextLevels));setProjectItem('tbm_soil_level_stations',JSON.stringify(nextStations));
    setSoilLevels(nextLevels);setSoilStations(nextStations);};
  const level=soilLevelAtStation(soilLevels,soilStations,track,session.currentSTA);
  const model=useMemo(()=>buildAlignmentPosition({sections:session.sections,vertical:session.vProfile,currentSTA:session.currentSTA,recovery:session.recovery}),[session]);
  const currentSoil=soilAt(session.currentSTA,track,level);
  const progress=model.errors.length?0:Math.round(model.currentDistance/model.totalDistance*100);
  return <div className="stack position-page">
    <PageHeader eyebrow="Tunnel position · Visual alignment" title={`ตำแหน่งหัวเจาะ ${mode.title}`} description="ดูหัวเจาะจาก STA ปัจจุบันบนแนวราบ แนวดิ่ง และหน้าตัดดิน โดยใช้ Alignment ของเครื่องที่เลือก" actions={<button className="btn btn-outline" onClick={()=>onNavigate('advanceplanner')}><Compass size={16}/>เปิดแผน Segment</button>}/>
    <div className="position-mode" role="group" aria-label="เลือกเครื่องเจาะ">
      {['EB','WB'].map(value=><button key={value} className="btn btn-outline" aria-pressed={track===value} onClick={()=>onTrackChange(value)}>
        <Crosshair size={17}/><span>{tbmMode(value).machine}</span><small>{value}</small></button>)}
    </div>
    <div className="position-stage"><div className="position-inputs card"><div><h3>ตำแหน่งปัจจุบัน · {mode.title}</h3><p className="section-note">ค่า STA และเยื้อง H/V เชื่อมกับหน้าแผน Segment ของเครื่องนี้</p></div>
      <div className="form-grid"><Field label="STA หัวเจาะปัจจุบัน"><input value={session.currentSTA} onChange={event=>setPlan({currentSTA:event.target.value,recovery:{...session.recovery,initialStateConfirmed:false}})}/></Field>
        <Field label="เยื้อง H (mm) · +ขวา"><input type="number" step="any" value={session.recovery.startDeviationH} onChange={event=>changeRecovery('startDeviationH',event.target.value)}/></Field>
        <Field label="เยื้อง V (mm) · +ขึ้น"><input type="number" step="any" value={session.recovery.startDeviationV} onChange={event=>changeRecovery('startDeviationV',event.target.value)}/></Field>
        <Field label="มุมหัวเจาะ H (°)"><input type="number" step="any" value={session.recovery.startHeadingErrorDeg} onChange={event=>changeRecovery('startHeadingErrorDeg',event.target.value)}/></Field>
        <Field label="มุมหัวเจาะ V (°)"><input type="number" step="any" value={session.recovery.startPitchErrorDeg} onChange={event=>changeRecovery('startPitchErrorDeg',event.target.value)}/></Field>
        <Field label="ศูนย์กลางหัวเจาะจากแบบดิน (mRL)"><input type="number" step="0.1" placeholder="ระบุระดับ mRL ณ STA นี้" value={level} onChange={event=>changeSoilLevel(event.target.value)}/></Field></div>
      <label className="position-confirm"><input type="checkbox" checked={session.recovery.initialStateConfirmed===true} onChange={event=>setPlan({recovery:{...session.recovery,initialStateConfirmed:event.target.checked}})}/>
        ยืนยัน STA, ระยะเยื้องและมุมจาก Survey / Navigation ของ {mode.title}</label>
      {!model.confirmed&&<p className="position-warning">ภาพหัวเจาะใช้ค่าตัวอย่าง/ยังไม่ยืนยันสนาม · กรอกค่าตรวจจริงและติ๊กยืนยันก่อนอ่านเป็นตำแหน่งปัจจุบัน</p>}
    </div><section className="card position-chart position-chart-top"><div className="position-chart-heading"><div><span className="eyebrow">01 · Top view</span><h3>แนวราบและตำแหน่งหัวเจาะ</h3></div><span className="position-badge">{mode.title}</span></div>
      {!model.errors.length?<TopView model={model}/>:<div className="position-chart-empty">ตรวจข้อมูล Alignment และ STA ก่อนแสดงภาพแนวราบ</div>}
      <p className="section-note">เส้นฟ้า = ขุดผ่านแล้ว · เส้นเทา = ช่วงที่เหลือ · รูปทรงจาก STA ชนิดช่วงและรัศมีที่กรอก เป็นพิกัดสัมพัทธ์ ไม่ใช่แผนที่สำรวจ · ระยะเยื้อง mm อ่านจากภาพขยายด้านล่าง</p></section></div>
    <ValidationErrors errors={model.errors}/>
    {!model.errors.length&&<><div className="position-stats"><div><small>ตำแหน่งหัวเจาะ</small><strong>{formattedSTA(model.current.sta)}</strong><span>{mode.title} · ช่วง {model.current.section}</span></div>
      <div><small>ขุดผ่านตาม Alignment</small><strong>{model.currentDistance.toFixed(1)} / {model.totalDistance.toFixed(1)} m</strong><span>{progress}% ของแนวที่กรอก</span></div>
      <div><small>ระดับแนวออกแบบ</small><strong>{model.current.elevation===null?'ไม่มีข้อมูล':`${model.current.elevation.toFixed(3)} m`}</strong><span>{session.verticalDatumConfirmed?'ยืนยัน datum mRL แล้ว':'ยังไม่ยืนยัน datum mRL'}</span></div>
      <div><small>ชั้นดิน ณ หัวเจาะ</small><strong>{currentSoil.soil?.label||'รอระดับ mRL'}</strong><span>{currentSoil.sheet?`Orange Line · หน้า ${currentSoil.sheet.page}/42`:'นอกช่วงแบบดิน'}</span></div></div>
      <div className="position-visual-grid"><section className="card position-chart position-chart-wide"><div className="position-chart-heading"><div><span className="eyebrow">02 · Longitudinal section</span><h3>แนวดิ่งตาม STA</h3></div><span className="position-badge">{session.verticalDatumConfirmed?'mRL ยืนยันแล้ว':'ระดับอ้างอิงยังไม่ยืนยัน datum'}</span></div>
          <LongitudinalSection model={model}/><p className="section-note">เส้นระดับจาก Alignment ที่กรอกในแผนเครื่องนี้ · กราฟขยายแนวดิ่งเพื่อให้อ่านความชันได้ ระยะเยื้อง V ระดับ mm อาจมองไม่เห็นที่สเกลทั้งแนว</p></section>
        <section className="card position-chart"><div className="position-chart-heading"><div><span className="eyebrow">03 · Face section</span><h3>หัวเจาะในหน้าตัดชั้นดิน</h3></div><Layers3 size={21}/></div>
          <SoilHeadSection station={session.currentSTA} track={track} level={level}/>
          <label className="position-confirm"><input type="checkbox" checked={session.verticalDatumConfirmed===true} onChange={event=>setPlan({verticalDatumConfirmed:event.target.checked})}/>
            ยืนยันว่าระดับ Alignment ใช้ datum mRL เดียวกับแบบ Orange Line</label>
          <button className="btn btn-outline" disabled={!session.verticalDatumConfirmed||!model.confirmed||model.tbm.elevation===null||model.tbm.elevation<30||model.tbm.elevation>105}
            onClick={()=>changeSoilLevel(model.tbm.elevation.toFixed(3))}>ใช้ระดับหัวเจาะจาก Alignment</button>
          <p className="section-note">ปุ่มนี้ใช้ได้หลังยืนยัน datum และค่าตรวจสนาม หากไม่ตรงกันให้กรอกระดับ mRL จากแบบ/Survey โดยตรง</p></section>
        <section className="card position-chart"><div className="position-chart-heading"><div><span className="eyebrow">04 · Detail zoom</span><h3>ขยายระยะเยื้องจากแนว</h3></div><Crosshair size={21}/></div><OffsetZoom model={model}/>
          <p className="section-note">ภาพขยายแสดงตำแหน่ง H/V ในหน่วย mm ตามเครื่องหมายที่กรอก ไม่ใช่หน้าตัดวงแหวนจริง</p></section></div></>}
    <details className="card position-editor"><summary>แก้ Alignment ของ {mode.title} ในหน้านี้</summary><p className="section-note">แก้แล้วภาพเปลี่ยนทันทีและบันทึกให้หน้าแผน Segment ของเครื่องเดียวกัน ตรวจ STA ให้ต่อเนื่องก่อนใช้ผล</p>
      <div className="position-editor-heading"><h3>แนวราบ</h3><button className="btn btn-outline" onClick={addSection}><Plus size={15}/>เพิ่มช่วง</button></div>
      <div className="position-edit-list">{session.sections.map((section,index)=><div className="position-edit-row" key={section.id||index}>
        <Field label="รหัส"><input value={section.code} onChange={event=>updateSection(index,'code',event.target.value)}/></Field>
        <Field label="STA เริ่ม"><input value={section.startSTA} onChange={event=>updateSection(index,'startSTA',event.target.value)}/></Field>
        <Field label="STA สิ้นสุด"><input value={section.endSTA} onChange={event=>updateSection(index,'endSTA',event.target.value)}/></Field>
        <Field label="ช่วงแนว"><select value={section.sectionType} onChange={event=>updateSection(index,'sectionType',event.target.value)}><option value="tangent">ทางตรง</option><option value="transition_in">เข้าโค้ง</option><option value="full_curve">โค้งเต็ม</option><option value="transition_out">ออกโค้ง</option></select></Field>
        <Field label="ทิศ"><select value={section.direction} onChange={event=>updateSection(index,'direction',event.target.value)}><option value="straight">ตรง</option><option value="right">ขวา</option><option value="left">ซ้าย</option></select></Field>
        <Field label="รัศมี R (m)"><input type="number" min="1" value={section.radius} disabled={section.sectionType==='tangent'||section.direction==='straight'} onChange={event=>updateSection(index,'radius',event.target.value)}/></Field>
        <button className="icon-button" aria-label={`ลบช่วงแนวราบ ${section.code}`} disabled={session.sections.length===1} onClick={()=>setAlignment({sections:session.sections.filter((_,i)=>i!==index)})}><Trash2 size={15}/></button>
      </div>)}</div>
      <div className="position-editor-heading"><h3>แนวดิ่ง</h3><button className="btn btn-outline" onClick={addVertical}><Plus size={15}/>เพิ่มช่วง</button></div>
      <div className="position-edit-list">{session.vProfile.map((element,index)=><div className="position-edit-row" key={element.id||index}>
        <Field label="รหัส"><input value={element.code} onChange={event=>updateVertical(index,'code',event.target.value)}/></Field>
        <Field label="STA เริ่ม"><input value={element.startSTA} onChange={event=>updateVertical(index,'startSTA',event.target.value)}/></Field>
        <Field label="STA สิ้นสุด"><input value={element.endSTA} onChange={event=>updateVertical(index,'endSTA',event.target.value)}/></Field>
        <Field label="ระดับเริ่ม (m)"><input type="number" step="0.001" value={element.startElev} onChange={event=>updateVertical(index,'startElev',event.target.value)}/></Field>
        <Field label="ระดับสิ้นสุด (m)"><input type="number" step="0.001" value={element.endElev} onChange={event=>updateVertical(index,'endElev',event.target.value)}/></Field>
        <Field label="ประเภท"><select value={element.curveType} onChange={event=>updateVertical(index,'curveType',event.target.value)}><option value="constant_grade">Grade ตรง</option><option value="sag_curve">Sag</option><option value="crest_curve">Crest</option></select></Field>
        {element.curveType!=='constant_grade'&&<Field label="รัศมี Rv (m)"><input type="number" min="1" value={element.radiusV} onChange={event=>updateVertical(index,'radiusV',event.target.value)}/></Field>}
        <button className="icon-button" aria-label={`ลบช่วงแนวดิ่ง ${element.code}`} disabled={session.vProfile.length===1} onClick={()=>setAlignment({vProfile:session.vProfile.filter((_,i)=>i!==index)})}><Trash2 size={15}/></button>
      </div>)}</div>
    </details>
  </div>;
}

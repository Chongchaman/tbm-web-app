import { useState } from 'react';
import { PageHeader, StatCard, InsightPanel, StatusBadge, EmptyState } from '../components/PlannerUI';
import LeadChart from '../components/LeadChart';
import GapVisualizer from '../components/GapVisualizer';
import { summarizeRings, recordKind, RECORD_LABELS, finite, round, readStored, getLimits, SEGMENT_WIDTHS } from '../services/decisionSupport';

export default function OperationsDashboard({ringLogs=[],plans=[],onNavigate=()=>{},theme='dark'}) {
  const [source,setSource]=useState('measured');
  const [selectedNum,setSelectedNum]=useState(null);
  const [windowSize,setWindowSize]=useState(20);
  const gaps=readStored('tbm_gap_settings',{});
  const rings=(source==='planned'?plans:ringLogs.filter(r=>recordKind(r)===source));
  const visible=rings.slice(-windowSize);
  const summary=summarizeRings(rings,getLimits(gaps));
  const selected=visible.find(r=>r.ringNum===selectedNum)||visible.at(-1);
  const lastFive=rings.slice(-5),previousFive=rings.slice(-10,-5);
  const avg=rows=>rows.length&&rows.every(r=>finite(r.hLead)&&finite(r.vLead))?rows.reduce((sum,r)=>sum+Math.hypot(Number(r.hLead),Number(r.vLead)),0)/rows.length:null;
  const trend=lastFive.length===5 && previousFive.length===5 && avg(lastFive)!==null && avg(previousFive)!==null ? round(avg(lastFive)-avg(previousFive)) : null;
  const sourceCount=kind=>(kind==='planned'?plans:ringLogs.filter(r=>recordKind(r)===kind)).length;
  return <div className="stack"><PageHeader eyebrow="Operations overview" title="ภาพรวมโครงการและจุดที่ต้องตรวจ" description="แยกข้อมูลสนาม แผนคาดการณ์ และข้อมูลตัวอย่าง พร้อมแนวโน้มจากข้อมูลที่เลือก"/>
    <div className="stat-grid"><StatCard label="ข้อมูลสนามที่ระบุแหล่งแล้ว" value={sourceCount('measured')} unit="ริง" onClick={()=>setSource('measured')}/><StatCard label="แผนคาดการณ์ที่บันทึก" value={plans.length} unit="ริง" onClick={()=>setSource('planned')}/><StatCard label="รอระบุแหล่งข้อมูล" value={sourceCount('legacy')} unit="ริง" detail="รายการเก่าไม่ถูกนับเป็นข้อมูลสนามอัตโนมัติ" onClick={()=>onNavigate('history','legacy')}/></div>
    <div className="section-heading"><div className="tab-strip">{Object.entries(RECORD_LABELS).map(([kind,label])=><button key={kind} aria-pressed={source===kind} onClick={()=>{setSource(kind);setSelectedNum(null);}}>{label} ({sourceCount(kind)})</button>)}</div><label className="flex gap-2 items-center section-note">ช่วงกราฟ<select className="field-control" value={windowSize} onChange={e=>setWindowSize(Number(e.target.value))}><option value={20}>20 ริงล่าสุด</option><option value={50}>50 ริงล่าสุด</option><option value={100}>100 ริงล่าสุด</option></select></label></div>
    {!rings.length?<EmptyState title={`ยังไม่มี${RECORD_LABELS[source]}`} action={<button className="btn btn-acc" onClick={()=>onNavigate('history',source)}>เปิดประวัติเพื่อเพิ่มหรือระบุข้อมูล</button>}>ข้อมูลสนามจะถูกนับเมื่อบันทึกค่าตรวจจริงในประวัติ ส่วนข้อมูลตัวอย่างเปิดดูได้จากตัวเลือกด้านบน</EmptyState>:<>
      <InsightPanel level={summary.level} title={`${RECORD_LABELS[source]} · ${summary.problemCount} ริงมีรายการตรวจ`} actions={<button className="btn btn-outline" onClick={()=>onNavigate('history',`${source}:issues`)}>ดูรายการที่ต้องตรวจ</button>}><p>Lead เกินเกณฑ์ {summary.leadCount} · Gap เตือน/วิกฤต {summary.gapCount} · DTA เกินเกณฑ์ {summary.dtaCount} ริง</p><p>{summary.maxDeviation===null?'ยังไม่มีพิกัด DTA: ระบบไม่ใช้ค่า Lead แทน deviation':'ค่า DTA มาจากรายการที่มีข้อมูล deviation โดยตรง'}</p>{trend!==null && <p>ค่าเฉลี่ยขนาด Lead 5 ริงล่าสุด {trend>0?'เพิ่มขึ้น':trend<0?'ลดลง':'ใกล้เคียงเดิม'} {Math.abs(trend)} mm เทียบกับ 5 ริงก่อนหน้า</p>}</InsightPanel>
      <div className="stat-grid"><StatCard label="ระยะตามชนิดเซ็กเมนต์" value={round(rings.reduce((sum,r)=>sum+(SEGMENT_WIDTHS[r.key?.[0]]||0)/1000,0))} unit="m" detail={RECORD_LABELS[source]}/><StatCard label="Lead สูงสุด |H| หรือ |V|" value={summary.maxLead} unit="mm"/><StatCard label="Gap ต่ำสุดที่มีข้อมูล" value={summary.minGap} unit="mm"/><StatCard label="DTA เบี่ยงเบนสูงสุด |Dev|" value={summary.maxDeviation} unit="mm" detail="แสดง — เมื่อยังไม่มีข้อมูล"/></div>
      <div className="card"><div className="section-heading"><h3>แนวโน้ม Lead · {visible.length} ริงล่าสุด</h3><span className="section-note">คลิกจุดบนกราฟเพื่อดูริง</span></div><LeadChart rings={visible} theme={theme} onSelect={r=>setSelectedNum(r.ringNum)}/></div>
      {selected && <div className="two-columns"><section className="card"><div className="section-heading"><h3>{selected.ringNum} · {selected.key}</h3><StatusBadge level={summary.assessed.find(r=>r.ring===selected)?.level}/></div><dl className="detail-list"><div><dt>H Lead</dt><dd>{selected.hLead} mm</dd></div><div><dt>V Lead</dt><dd>{selected.vLead} mm</dd></div><div><dt>DTA offset</dt><dd>{finite(selected.deviationMm)?`${selected.deviationMm} mm`:'ยังไม่มีข้อมูล'}</dd></div><div><dt>แหล่งข้อมูล</dt><dd>{RECORD_LABELS[recordKind(selected)]}</dd></div></dl><p className="section-note mt-4">{selected.notes||'ไม่มีหมายเหตุ'}</p></section><GapVisualizer gapT={selected.gapT} gapB={selected.gapB} gapL={selected.gapL} gapR={selected.gapR} source={RECORD_LABELS[source]} warnThreshold={gaps.warnThreshold??15} blockThreshold={gaps.criticalThreshold??5}/></div>}
    </>}
  </div>;
}

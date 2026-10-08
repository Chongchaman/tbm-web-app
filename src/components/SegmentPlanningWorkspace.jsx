import { AlertTriangle, Calculator, Download, Map, Save, Settings2 } from 'lucide-react';
import { KEY_DATA } from '../data/tbmConstants';
import { Field, PageHeader, ValidationErrors } from './PlannerUI';
import KeySuitabilityBadge from './KeySuitabilityBadge';
import Tunnel2DVisualizer from './Tunnel2DVisualizer';

const segmentName = ring => ring.type === 'U' ? 'UN' : ring.type === 'R' ? 'RT' : 'LT';

function MiniStat({ label, value, tone = '' }) {
  return <div className={`planner-mini-stat ${tone}`}><small>{label}</small><strong>{value}</strong></div>;
}

function RingTable({ rings, selectedStep, onSelect, filter, onFilter }) {
  return <div className="planner-table-shell">
    <div className="planner-table-toolbar">
      <div className="planner-filter" role="group" aria-label="กรองตารางริง">
        {[['all','ทุกริง'],['issues','ต้องตรวจ'],['lead','Lead'],['dta','DTA'],['gap','Gap']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>onFilter(value)}>{label}</button>)}
      </div>
      <span>{rings.length} ริง</span>
    </div>
    <div className="planner-table-scroll">
      <table className="planner-ring-table">
        <thead><tr><th>Ring / STA</th><th>Segment</th><th>Lead H/V</th><th>DTA H/V</th><th>Gap ต่ำสุด</th><th>ผล</th></tr></thead>
        <tbody>{rings.map(ring => {
          const hasIssue=ring.exceedsLimit||ring.isGapWarn||ring.isGapCrit||Math.abs(ring.deviationMm)>75||Math.abs(ring.deviationVMm)>75;
          return <tr key={ring.step} className={selectedStep===ring.step?'is-selected':''} onClick={()=>onSelect(ring.step)}>
            <td><strong>{ring.ringNum}</strong><small>{ring.sta} · #{ring.step}</small></td>
            <td><b className={`segment-pill segment-${ring.type.toLowerCase()}`}>{ring.selectedKey}</b><small>{segmentName(ring)} · {ring.sizeM} m</small></td>
            <td><strong>{ring.afterH} / {ring.afterV}</strong><small>mm</small></td>
            <td><strong>{ring.deviationMm} / {ring.deviationVMm}</strong><small>mm</small></td>
            <td><strong>{ring.minGap}</strong><small>mm</small></td>
            <td>{hasIssue?<span className="planner-row-status is-warning"><AlertTriangle size={12}/>ตรวจ</span>:<KeySuitabilityBadge suitability={ring.suitability} size="sm"/>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>;
}

export default function SegmentPlanningWorkspace({
  track, onNavigate, inputErrors, needsRecalc, appliedSuccess, saving,
  handleCalculate, handleBatchSave, handleExportCSV, handleResetSections,
  currentSTA, changeCurrentSTA, recovery, changeRecovery, strategy, changeStrategy,
  startKey, changeStartKey, startHLead, changeStartHLead, startVLead, changeStartVLead,
  maxTolerance, changeMaxTolerance, steeringSign, changeSteeringSign,
  planResult, summary, sections, resultFilter, setResultFilter, tableRings,
  scrubStep, setScrubStep, selectedRing,
}) {
  const machine=track==='EB'?'TBM1 · E/B':'TBM2 · W/B';
  const warningCount=summary.leadCount+summary.dtaCount+summary.gapCount;
  return <div className="planner-page">
    <PageHeader eyebrow={`Segment planning · ${machine}`} title={`วางแผน Segment ${machine}`} description="ดูแนวอุโมงค์และตารางริงพร้อมกัน เลือกริงจากตารางเพื่อดูตำแหน่งและค่าตรวจทันที" actions={<>
      <button className="btn btn-outline planner-secondary-action" onClick={()=>onNavigate('position')}><Map size={16}/>ตำแหน่งหัวเจาะ</button>
      <button className="btn btn-acc" onClick={handleCalculate}><Calculator size={16}/>{needsRecalc?'คำนวณใหม่':'คำนวณแผน'}</button>
      <button className="btn btn-outline" onClick={handleBatchSave} disabled={needsRecalc||saving||!planResult.plannedRings.length}><Save size={16}/>{saving?'กำลังบันทึก…':'บันทึกแผน'}</button>
    </>}/>
    <ValidationErrors errors={inputErrors}/>
    {appliedSuccess && <div className="planner-inline-success">บันทึกแผนคาดการณ์ {planResult.plannedRings.length} ริงแล้ว</div>}
    <div className="planner-commandbar">
      <Field label="STA หัวเจาะ"><input value={currentSTA} onChange={event=>changeCurrentSTA(event.target.value)}/></Field>
      <Field label="วิธีเลือก Segment"><select value={strategy} onChange={event=>changeStrategy(event.target.value)}><option value="senior_ai">มองล่วงหน้าและตรวจข้อจำกัด</option><option value="ratio_guided">ยึด Ratio รายช่วง</option></select></Field>
      <Field label="คีย์เริ่มต้น"><select value={startKey} onChange={event=>changeStartKey(event.target.value)}>{Object.keys(KEY_DATA).map(key=><option key={key}>{key}</option>)}</select></Field>
      <div className="planner-live-summary">
        <MiniStat label="แผนทั้งหมด" value={`${planResult.totalRings} ริง`}/>
        <MiniStat label="UN / RT / LT" value={`${planResult.counts.un} / ${planResult.counts.rt} / ${planResult.counts.lt}`}/>
        <MiniStat label="ต้องตรวจ" value={`${warningCount} จุด`} tone={warningCount?'is-warning':'is-good'}/>
        <MiniStat label="Gap ต่ำสุด" value={`${summary.minGap??'—'} mm`} tone={summary.gapCount?'is-warning':'is-good'}/>
      </div>
    </div>
    {needsRecalc && <div className="planner-recalc-note">ค่าตั้งต้นเปลี่ยนแล้ว กด “คำนวณใหม่” เพื่ออัปเดต Visual และตาราง</div>}
    <details className="planner-settings-drawer">
      <summary><Settings2 size={16}/><strong>ตั้งค่าแผนและ Alignment</strong><span>Survey, Lead, เกณฑ์ และ Ratio</span></summary>
      <div className="planner-settings-body">
        <div className="planner-settings-grid">
          {[['startDeviationH','เยื้อง H (mm)'],['startDeviationV','เยื้อง V (mm)'],['startHeadingErrorDeg','มุมคลาด H (°)'],['startPitchErrorDeg','มุมคลาด V (°)'],['recoveryDistanceM','ระยะกลับเข้าแนว (m)'],['endpointToleranceMm','เกณฑ์ปลายทาง ± (mm)']].map(([key,label])=><Field key={key} label={label}><input type="number" step="any" value={recovery[key]} onChange={event=>changeRecovery(key,event.target.value)}/></Field>)}
          <Field label="H Lead เริ่มต้น"><input type="number" step="0.1" value={startHLead} onChange={event=>changeStartHLead(event.target.value)}/></Field>
          <Field label="V Lead เริ่มต้น"><input type="number" step="0.1" value={startVLead} onChange={event=>changeStartVLead(event.target.value)}/></Field>
          <Field label="Lead Limit ± (mm)"><input type="number" value={maxTolerance} onChange={event=>changeMaxTolerance(event.target.value)}/></Field>
          <Field label="เป้าหมายการเลี้ยว"><select value={steeringSign} onChange={event=>changeSteeringSign(event.target.value)}><option value="steering_bias">ตรงข้าม Lead โค้ง</option><option value="standard_positive">ตาม Lead โค้ง</option></select></Field>
        </div>
        <label className="planner-survey-confirm"><input type="checkbox" checked={recovery.initialStateConfirmed} onChange={event=>changeRecovery('initialStateConfirmed',event.target.checked)}/>ยืนยันค่าตำแหน่งและมุมจาก Survey / Navigation</label>
        <div className="planner-alignment-row"><div><strong>Alignment {sections.length} ช่วง</strong><span>{sections.map(section=>section.code).join(' → ')}</span></div><button className="btn btn-outline" onClick={handleResetSections}>ใช้ช่วงตาม Drawing</button><button className="btn btn-outline" onClick={()=>onNavigate('masterdata')}>แก้ Alignment และ Ratio</button></div>
      </div>
    </details>
    <div className="planner-workbench">
      <section className="card planner-visual-pane">
        <div className="planner-pane-heading"><div><span className="eyebrow">VISUAL PLAN</span><h3>แนว Segment และ DTA</h3></div>{selectedRing&&<div className="planner-selected-ring"><strong>{selectedRing.ringNum} · {selectedRing.selectedKey}</strong><span>STA {selectedRing.sta} · Lead {selectedRing.afterH}/{selectedRing.afterV} mm</span></div>}</div>
        <div className="planner-visual-scroll"><Tunnel2DVisualizer compact planResult={planResult} scrubStep={scrubStep} onSelectStep={setScrubStep}/></div>
      </section>
      <section className="card planner-table-pane">
        <div className="planner-pane-heading"><div><span className="eyebrow">SEGMENT SCHEDULE</span><h3>ตารางแผนเรียงตามลำดับติดตั้ง</h3></div><button className="btn btn-outline" disabled={needsRecalc||!planResult.plannedRings.length} onClick={handleExportCSV}><Download size={15}/>CSV</button></div>
        <RingTable rings={tableRings} selectedStep={scrubStep} onSelect={setScrubStep} filter={resultFilter} onFilter={setResultFilter}/>
      </section>
    </div>
  </div>;
}

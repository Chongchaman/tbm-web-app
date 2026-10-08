import { Crosshair, Layers3, LocateFixed } from 'lucide-react';
import { Field } from './PlannerUI';
import {
  SOIL_CLASSES, SOIL_LIMITS, SOIL_SOURCE, SOIL_TRACKS, clampSoilStation, formatSTA,
  soilAt, soilProfileRange, soilSheetAt, stationMeters, tunnelElevationAt, tunnelProfileRange,
} from '../services/soilProfile';

const WIDTH = 1040;
const HEIGHT = 480;
const PLOT = { left: 72, right: 1018, top: 30, bottom: 416 };

function verticalRuns(column) {
  const runs = [];
  for (let index = 0; index < column.codes.length; index += 1) {
    const code = column.codes[index];
    const last = runs.at(-1);
    if (last?.code === code) last.end = index + 1;
    else runs.push({ code, start: index, end: index + 1 });
  }
  return runs;
}

function SoilProfileChart({ track, start, end, current }) {
  const columns = soilProfileRange(start, end, track);
  const selectedProfile = tunnelProfileRange(start, end, track);
  const otherTrack = track === 'EB' ? 'WB' : 'EB';
  const otherProfile = tunnelProfileRange(start, end, otherTrack);
  const currentPoint = tunnelElevationAt(current, track);
  if (!columns.length || !selectedProfile.length) return <div className="soil-empty">เลือกช่วง STA ภายใน OR10 ถึง TCC เพื่อแสดงรูปตัด</div>;

  const startMeters = clampSoilStation(start, track);
  const endMeters = clampSoilStation(end, track);
  const lo = Math.min(startMeters, endMeters);
  const hi = Math.max(startMeters, endMeters);
  const elevationMin = Math.min(...columns.map(column => column.minElevation));
  const elevationMax = Math.max(...columns.map(column => column.maxElevation));
  const x = station => PLOT.left + (station - lo) / Math.max(1, hi - lo) * (PLOT.right - PLOT.left);
  const y = elevation => PLOT.top + (elevationMax - elevation) / Math.max(1, elevationMax - elevationMin) * (PLOT.bottom - PLOT.top);
  const columnWidth = Math.max(2, (PLOT.right - PLOT.left) / Math.max(1, columns.length - 1) + 1);
  const path = profile => profile.map((row, index) => `${index ? 'L' : 'M'}${x(row[0]).toFixed(1)},${y(row[1]).toFixed(1)}`).join(' ');
  const tickCount = Math.min(6, Math.max(2, Math.ceil((hi - lo) / 100)));
  const stationTicks = Array.from({ length: tickCount + 1 }, (_, index) => lo + (hi - lo) * index / tickCount);
  const elevationTicks = Array.from({ length: Math.floor((elevationMax - elevationMin) / 5) + 1 }, (_, index) => elevationMin + index * 5);
  const currentMeters = stationMeters(current);
  const inView = currentPoint && currentMeters >= lo && currentMeters <= hi;
  const cx = inView ? x(currentMeters) : 0;
  const cy = inView ? y(currentPoint.elevation) : 0;
  const machineHeight = 6.3 / (elevationMax - elevationMin) * (PLOT.bottom - PLOT.top);
  const nearby = selectedProfile.reduce((best, row) => Math.abs(row[0] - currentMeters) < Math.abs(best[0] - currentMeters) ? row : best, selectedProfile[0]);
  const second = selectedProfile.find(row => row[0] > nearby[0]) || nearby;
  const first = [...selectedProfile].reverse().find(row => row[0] < nearby[0]) || nearby;
  const angle = Math.atan2(y(second[1]) - y(first[1]), x(second[0]) - x(first[0])) * 180 / Math.PI;

  return <div className="soil-chart-wrap">
    <svg className="soil-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`รูปตัดชั้นดินและตำแหน่งหัวเจาะ ${track} จาก ${formatSTA(lo)} ถึง ${formatSTA(hi)}`}>
      <defs><filter id="soil-head-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity=".35"/></filter></defs>
      <rect x={PLOT.left} y={PLOT.top} width={PLOT.right-PLOT.left} height={PLOT.bottom-PLOT.top} className="soil-chart-bg"/>
      {columns.map((column, index) => verticalRuns(column).map((run, runIndex) => {
        const topElevation = column.maxElevation - run.start;
        const bottomElevation = column.maxElevation - run.end;
        return <rect key={`${index}-${runIndex}`} x={x(column.station)-columnWidth/2} y={y(topElevation)} width={columnWidth}
          height={Math.max(1, y(bottomElevation)-y(topElevation))} fill={SOIL_CLASSES[run.code]?.color || 'transparent'}/>;
      }))}
      {elevationTicks.map(elevation => <g key={elevation}><line x1={PLOT.left} x2={PLOT.right} y1={y(elevation)} y2={y(elevation)} className="soil-grid-line"/>
        <text x={PLOT.left-9} y={y(elevation)+4} textAnchor="end" className="soil-axis-label">{elevation}</text></g>)}
      {stationTicks.map(station => <g key={station}><line x1={x(station)} x2={x(station)} y1={PLOT.top} y2={PLOT.bottom} className="soil-grid-line"/>
        <text x={x(station)} y={PLOT.bottom+24} textAnchor="middle" className="soil-axis-label">{formatSTA(station).replace('.000','')}</text></g>)}
      {otherProfile.length > 1 && <path d={path(otherProfile)} className="soil-rail soil-rail-other"/>}
      <path d={path(selectedProfile)} className="soil-rail soil-rail-active"/>
      {inView && <g className="soil-tbm-marker">
        <line x1={cx} x2={cx} y1={PLOT.top} y2={PLOT.bottom} className="soil-current-line"/>
        <g transform={`translate(${cx} ${cy}) rotate(${angle})`} filter="url(#soil-head-shadow)">
          <rect x="-18" y={-machineHeight/2} width="36" height={machineHeight} rx="5"/>
          <path d={`M18 ${-machineHeight/2} L27 0 L18 ${machineHeight/2} Z`}/>
          <line x1="-10" x2="-10" y1={-machineHeight/2+3} y2={machineHeight/2-3}/>
        </g>
        <g className="soil-head-label" transform={`translate(${Math.min(PLOT.right-158,Math.max(PLOT.left+6,cx+12))} ${Math.max(PLOT.top+8,cy-machineHeight/2-49)})`}>
          <rect width="152" height="41" rx="7"/><text x="9" y="16">หัวเจาะ {track}</text><text x="9" y="32">{formatSTA(current)} · {currentPoint.elevation.toFixed(2)} mRL</text>
        </g>
      </g>}
      <text x="18" y={(PLOT.top+PLOT.bottom)/2} transform={`rotate(-90 18 ${(PLOT.top+PLOT.bottom)/2})`} textAnchor="middle" className="soil-axis-title">ระดับ (mRL)</text>
      <text x={(PLOT.left+PLOT.right)/2} y="472" textAnchor="middle" className="soil-axis-title">Station</text>
    </svg>
    {!inView && <div className="soil-chart-message"><LocateFixed size={16}/>หัวเจาะอยู่นอกช่วงที่กำลังแสดง</div>}
  </div>;
}

export default function SoilProfilePanel({ track, onTrackChange, currentStation, range, onCurrentChange, onRangeChange }) {
  const limit = SOIL_LIMITS[track];
  const point = tunnelElevationAt(currentStation, track);
  const sheet = soilSheetAt(currentStation, track);
  const result = point ? soilAt(currentStation, track, point.elevation) : { status: 'outside' };
  const setPreset = span => {
    const center = clampSoilStation(currentStation, track);
    onRangeChange({ start: formatSTA(Math.max(limit.start, center-span)), end: formatSTA(Math.min(limit.end, center+span)) });
  };
  return <section className="card soil-panel" aria-label="ชั้นดินจากแบบ Soil Profile">
    <div className="soil-heading">
      <div><span className="eyebrow">Orange Line · OR10 → TCC</span><h3>ตำแหน่งหัวเจาะในชั้นดิน</h3>
        <p className="section-note">เลือกระยะ STA ที่ต้องการดู เส้นแนวและระดับหัวเจาะอ่านจากแบบของ E/B และ W/B โดยอัตโนมัติ</p></div>
      <div className="soil-track-switch" role="group" aria-label="เลือกเครื่องเจาะ">
        {SOIL_TRACKS.map(value => <button key={value} type="button" className="btn btn-outline" aria-pressed={track === value}
          onClick={() => onTrackChange(value)}>{value === 'EB' ? 'TBM1 · E/B' : 'TBM2 · W/B'}</button>)}
      </div>
    </div>
    <div className="soil-control-grid">
      <Field label={`STA หัวเจาะ ${track}`}><input value={currentStation} onChange={event=>onCurrentChange(event.target.value)} placeholder="เช่น 20+180.000"/></Field>
      <Field label="STA เริ่มแสดง"><input value={range.start} onChange={event=>onRangeChange({...range,start:event.target.value})}/></Field>
      <Field label="STA สิ้นสุดแสดง"><input value={range.end} onChange={event=>onRangeChange({...range,end:event.target.value})}/></Field>
      <div className="soil-range-presets" aria-label="เลือกช่วงแสดงผล"><button className="btn btn-outline" onClick={()=>setPreset(100)}>±100 m</button><button className="btn btn-outline" onClick={()=>setPreset(250)}>±250 m</button><button className="btn btn-outline" onClick={()=>onRangeChange({start:formatSTA(limit.start),end:formatSTA(limit.end)})}>ทั้งหมด</button></div>
    </div>
    <div className="soil-summary">
      <div><Crosshair size={19}/><span>ตำแหน่งปัจจุบัน<strong>{formatSTA(currentStation)}</strong></span></div>
      <div><LocateFixed size={19}/><span>ระดับศูนย์กลางจากแบบ<strong>{point ? `${point.elevation.toFixed(3)} mRL` : 'นอกช่วงแบบ'}</strong></span></div>
      <div><Layers3 size={19}/><span>ชั้นดินที่หัวเจาะ<strong>{result.soil?.label || (result.status==='unclear'?'รอยต่อ/อ่านไม่ชัด':'นอกช่วงแบบ')}</strong></span></div>
      <div><span className="soil-page-number">{sheet?.page || '—'}</span><span>หน้าแบบอ้างอิง<strong>{sheet ? `${sheet.page}/42 · ${track}` : '—'}</strong></span></div>
    </div>
    <SoilProfileChart track={track} start={range.start} end={range.end} current={currentStation}/>
    <div className="soil-chart-key"><span><i className="key-active"/>แนว {track} ที่เลือก</span><span><i className="key-other"/>แนว {track==='EB'?'WB':'EB'} เปรียบเทียบ</span><span><i className="key-head"/>หัวเจาะ Ø6.30 m</span></div>
    <div className="soil-legend">{Object.values(SOIL_CLASSES).map(item => <span key={item.english}><i style={{background:item.color}}/>{item.label}</span>)}</div>
    <p className="section-note soil-disclaimer">ขอบเขต: {track==='EB'?'E/B หน้า 14–21 สิ้นสุด TCC 23+390.269':'W/B หน้า 35–42 สิ้นสุด TCC 23+396.443'} · แหล่งข้อมูล {SOIL_SOURCE} · ภาพนี้ถอดสีชั้นดินทุกประมาณ 20 m และเส้นระดับจากแบบ ใช้ช่วยมองภาพรวมและต้องตรวจแบบต้นฉบับ/ข้อมูลสำรวจก่อนตัดสินใจหน้างาน</p>
  </section>;
}

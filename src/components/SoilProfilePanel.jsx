import { Field } from './PlannerUI';
import { SOIL_SOURCE, SOIL_TRACKS, soilAt, soilColumnAt, soilSheetAt } from '../services/soilProfile';

const formatSTA = value => {
  const km = Math.floor(value / 1000);
  return `${String(km).padStart(2, '0')}+${(value % 1000).toFixed(3).padStart(7, '0')}`;
};

export default function SoilProfilePanel({ station, track, onTrackChange, elevations, onElevationChange }) {
  return <section className="card soil-panel" aria-label="ชั้นดินจากแบบ Soil Profile">
    <div className="soil-heading">
      <div><span className="eyebrow">Orange Line · Soil profile</span><h3>ชั้นดินที่ STA {station || '—'}</h3>
        <p className="section-note">แผน EB และ WB แยกกัน · หน้าตัดชั้นดินด้านล่างอ่านจากแบบโครงการตาม STA และระดับ mRL</p></div>
      <div className="soil-track-switch" role="group" aria-label="เลือกแนวสำหรับวางแผน">
        {SOIL_TRACKS.map(value => <button key={value} type="button" className="btn btn-outline" aria-pressed={track === value}
          onClick={() => onTrackChange(value)}>{value === 'EB' ? 'TBM1 · EB' : 'TBM2 · WB'}</button>)}
      </div>
    </div>
    <div className="soil-track-grid">{SOIL_TRACKS.map(value => {
      const sheet = soilSheetAt(station, value);
      const result = soilAt(station, value, elevations[value]);
      const column = soilColumnAt(station, value);
      return <div className={`soil-track-card ${track === value ? 'is-active' : ''}`} key={value}>
        <div className="soil-card-title"><strong>{value}</strong><span>{track === value ? 'กำลังวางแผนแนวนี้' : 'ดูเทียบอีกแนว'}</span></div>
        {sheet ? <><p className="section-note">STA {formatSTA(sheet.start)}–{formatSTA(sheet.end)} · หน้า {sheet.page}/42 · {sheet.drawing}</p>
          <Field label={`ระดับศูนย์กลางอุโมงค์ ${value} (mRL)`}><input type="number" inputMode="decimal" step="0.1" min="30" max="105"
            placeholder="กรอกจากแบบแนวอุโมงค์" value={elevations[value] ?? ''}
            onChange={event => onElevationChange(value, event.target.value)}/></Field>
          <div className={`soil-result soil-result-${result.status}`} role="status">
            {result.status === 'needs-elevation' && <><strong>ระบุระดับ mRL เพื่ออ่านชั้นดินที่หัวเจาะ</strong><span>STA เดียวมีหลายชั้นดินตามความลึก</span></>}
            {result.status === 'elevation-outside' && <><strong>ระดับอยู่นอกกราฟแบบ</strong><span>กราฟนี้ครอบคลุมประมาณ mRL +30 ถึง +105</span></>}
            {result.status === 'unclear' && <><strong>จุดนี้อ่านสีชั้นดินไม่ชัด</strong><span>เปิดหน้าแบบ {sheet.page} ตรวจด้วยตาและเทียบข้อมูลเจาะสำรวจ</span></>}
            {['boundary', 'interpreted'].includes(result.status) && <><strong>{result.soil.label}</strong>
              <span>{result.status === 'boundary' ? 'ใกล้รอยต่อชั้นดิน/สัญลักษณ์ทับซ้อน · ต้องตรวจจากแบบจริง' : 'อ่านสีหน้าตัดเบื้องต้น · ตรวจหน้าจริงก่อนใช้ตัดสินใจ'}</span></>}
          </div>
          <div className="soil-column" aria-label={`ลำดับชั้นดินแนว ${value} ตามระดับ mRL`}>
            {column.map(({elevation, soil}, index) => <div key={index} className="soil-column-cell"
              title={`mRL +${elevation}: ${soil?.label || 'อ่านไม่ชัด/ดินถม/นอกขอบแบบ'}`}
              style={{ background: soil?.color || 'var(--surf-3)' }}><small>{elevation}</small></div>)}
          </div><p className="soil-column-caption">ระดับ mRL จาก +105 → +30 (ช่องละ 5 m) · ชี้เพื่อดูชื่อชั้นดิน</p>
        </> : <div className="soil-result"><strong>STA อยู่นอกช่วงแบบหรือรูปแบบไม่ถูกต้อง</strong><span>EB 09+977.640–23+390.269 · WB 09+977.640–23+396.443</span></div>}
      </div>;
    })}</div>
    <div className="soil-legend">{[['#79c4d6','ดินเหนียวอ่อน'],['#c2d63b','ดินเหนียวแข็งปานกลาง'],['#de8992','ดินเหนียวแข็ง'],['#ebc972','ทรายปนดิน/ทรายแน่น']].map(([color,label]) =>
      <span key={label}><i style={{background:color}}/>{label}</span>)}</div>
    <p className="section-note soil-disclaimer">แหล่งข้อมูล: MRT Orange Line · {SOIL_SOURCE} (42 หน้า) · สีชั้นดินถอดจากภาพแบบด้วยการประมาณทุก 20 m ตาม STA และทุก 1 m ตามระดับ จึงใช้คัดกรองเบื้องต้นเท่านั้น การระบุชั้นดินหน้าหัวเจาะต้องยืนยันระดับ mRL/datum, รูปตัดอุโมงค์, รอยต่อ และ borehole กับวิศวกรธรณีเทคนิค ระดับ Alignment ที่ตั้งไว้ในแอปยังไม่ได้สอบเทียบกับ mRL ของแบบนี้</p>
  </section>;
}

import { StatusBadge } from './PlannerUI';
import { finite } from '../services/decisionSupport';

export default function GapMonitor({ gapT, gapB, gapL, gapR, warnThreshold = 15, blockThreshold = 5, nominal = 50, editable = false, onChange = () => {}, source = 'ค่าคาดการณ์' }) {
  const values = { gapT, gapB, gapL, gapR };
  const known = Object.values(values).every(finite);
  const min = known ? Math.min(...Object.values(values).map(Number)) : null;
  const status = value => !finite(value) ? 'unknown' : Number(value) <= blockThreshold ? 'critical' : Number(value) <= warnThreshold ? 'warning' : 'normal';
  return <section className="gap-monitor"><div className="section-heading"><div><h3>Tail Gap · 4 ด้าน</h3><span className="source-label">{source} · Nominal {nominal} mm</span></div><StatusBadge level={known ? status(min) : 'unknown'} /></div>
    <div className="gap-quadrants">{[['gapT', 'บน (T)'], ['gapB', 'ล่าง (B)'], ['gapL', 'ซ้าย (L)'], ['gapR', 'ขวา (R)']].map(([key, label]) => <label className={`gap-cell status-${status(values[key])}`} key={key}><span>{label}</span>{editable ? <input type="number" min="0" step=".1" aria-label={`Gap ${label} (mm)`} value={values[key] ?? ''} onChange={e => onChange(key, e.target.value)} /> : <strong>{finite(values[key]) ? Number(values[key]).toFixed(1) : '—'} <small>mm</small></strong>}</label>)}</div>
    <p>ต่ำสุด {min === null ? '—' : min.toFixed(1)} mm · เตือน ≤{warnThreshold} · วิกฤต ≤{blockThreshold} mm</p>
  </section>;
}

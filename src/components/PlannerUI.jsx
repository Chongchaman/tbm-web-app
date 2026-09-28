import { useId, cloneElement, isValidElement, useRef, useEffect, useEffectEvent } from 'react';
import { AlertTriangle, CircleCheck, CircleHelp, OctagonAlert, ChevronRight } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function StatusBadge({ level = 'unknown', children }) {
  const Icon = { normal: CircleCheck, warning: AlertTriangle, critical: OctagonAlert, unknown: CircleHelp }[level] || CircleHelp;
  return <span className={`status-badge status-${level}`}><Icon size={15} aria-hidden="true" />{children || { normal: 'อยู่ในเกณฑ์', warning: 'มีคำเตือน', critical: 'ต้องตรวจทาน', unknown: 'ข้อมูลไม่ครบ' }[level]}</span>;
}

export function InsightPanel({ level = 'unknown', title, children, actions }) {
  const Icon = { normal: CircleCheck, warning: AlertTriangle, critical: OctagonAlert, unknown: CircleHelp }[level] || CircleHelp;
  return <section className={`insight-panel status-${level}`} aria-label={title}><Icon size={22} aria-hidden="true" /><div className="insight-copy"><h3>{title}</h3>{children}</div>{actions && <div className="insight-actions">{actions}</div>}</section>;
}

export function StatCard({ label, value, unit, detail, onClick }) {
  const content = <><span className="stat-label">{label}</span><strong className="stat-value">{value ?? '—'} <small>{unit}</small></strong>{detail && <span className="stat-detail">{detail}</span>}{onClick && <ChevronRight size={16} className="stat-arrow" aria-hidden="true" />}</>;
  return onClick ? <button className="stat-card stat-clickable" type="button" onClick={onClick}>{content}</button> : <div className="stat-card">{content}</div>;
}

export function Field({ label, children, hint }) {
  const generated = useId();
  const controlId = children?.props?.id || generated;
  const content = isValidElement(children) ? cloneElement(children, { id: controlId, 'aria-labelledby': `${generated}-label`, 'aria-describedby': hint ? `${generated}-hint` : children.props['aria-describedby'] }) : children;
  return <label className="field" htmlFor={controlId}><span id={`${generated}-label`}>{label}</span>{content}{hint && <small className="hint" id={`${generated}-hint`}>{hint}</small>}</label>;
}

export function EmptyState({ title, children, action }) {
  return <div className="empty-state"><CircleHelp size={28} aria-hidden="true" /><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function ValidationErrors({ errors = [] }) {
  return errors.length ? <div className="validation-errors" role="alert"><strong>ตรวจข้อมูลก่อนดำเนินการ</strong><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div> : null;
}

export function PlanInsight({ summary, children, actions }) {
  return <InsightPanel level={summary.level} title={summary.total === 0 ? 'ยังไม่มีผลคำนวณ' : summary.level === 'normal' ? 'อยู่ในเกณฑ์ที่ระบบตรวจ — รอการตรวจทานก่อนใช้' : `พบ ${summary.problemCount} ริงที่ต้องตรวจทาน`} actions={actions}>
    <p>{summary.total > 0 ? `Lead เกินเกณฑ์ ${summary.leadCount} ริง · DTA เกินเกณฑ์ ${summary.dtaCount} ริง · Gap เตือน/วิกฤต ${summary.gapCount} ริง` : 'กรอกข้อมูลและคำนวณเพื่อดูผล'}</p>{children}
  </InsightPanel>;
}


export function Dialog({ children, label, className = 'dialog', onClose, busy = false, ...props }) {
  const ref = useRef(null);
  const dismiss = useEffectEvent(() => { if (!busy) onClose?.(); });
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const surface = ref.current;
    const controls = () => [...surface.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    (surface.querySelector('[autofocus]') || controls()[0] || surface).focus();
    document.body.style.overflow = 'hidden';
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key === 'Tab') {
        const items = controls(), first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); surface.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !surface.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !surface.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = previousOverflow; previous?.focus?.(); };
  }, []);
  return <section {...props} ref={ref} className={className} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</section>;
}

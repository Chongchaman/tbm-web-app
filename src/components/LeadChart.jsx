import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function LeadChart({ rings, limit = 55, onSelect, theme = 'dark' }) {
  const muted = theme === 'light' ? '#526278' : '#a7b6cb';
  return <div className="lead-chart" role="img" aria-label={`แนวโน้ม H/V Lead ${rings.length} ริง หน่วย mm เกณฑ์ ±${limit} mm`}><Line data={{
    labels: rings.map(r => r.ringNum),
    datasets: [
      { label: 'H Lead (mm)', data: rings.map(r => r.afterH ?? r.hLead), borderColor: '#5095eb', pointRadius: rings.length > 60 ? 0 : 3, borderWidth: 2, tension: .1 },
      { label: 'V Lead (mm)', data: rings.map(r => r.afterV ?? r.vLead), borderColor: '#bb8ddf', pointRadius: rings.length > 60 ? 0 : 3, borderWidth: 2, tension: .1 },
      ...[limit, -limit].map(value => ({ label: `เกณฑ์ ${value} mm`, data: rings.map(() => value), borderColor: '#c48943', borderDash: [5, 5], pointRadius: 0, borderWidth: 1 })),
    ],
  }} options={{ responsive: true, maintainAspectRatio: false, animation: false, interaction: { intersect: false, mode: 'index' }, onClick: (_event, elements) => { if (elements.length && onSelect) onSelect(rings[elements[0].index]); }, plugins: { legend: { labels: { color: muted, font: { size: 12 }, boxWidth: 20, boxHeight: 2 } } }, scales: { x: { ticks: { color: muted, maxTicksLimit: 8 }, grid: { display: false }, title: { display: true, text: 'หมายเลขริง', color: muted } }, y: { ticks: { color: muted }, grid: { color: theme === 'light' ? '#e2e8f0' : '#29374a' }, title: { display: true, text: 'Lead (mm)', color: muted } } } }} /></div>;
}

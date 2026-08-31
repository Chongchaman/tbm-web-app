import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Layers, 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  Compass, 
  Clock, 
  ArrowUpRight,
  Database
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import GapVisualizer from '../components/GapVisualizer';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardView({ ringLogs = [] }) {
  const latestRing = ringLogs.length > 0 ? ringLogs[ringLogs.length - 1] : null;

  // Compute Summary Statistics
  const stats = useMemo(() => {
    const total = ringLogs.length;
    if (total === 0) return { total: 0, avgH: 0, avgV: 0, maxDev: 0, rCount: 0, lCount: 0, uCount: 0 };

    let sumH = 0;
    let sumV = 0;
    let maxDev = 0;
    let rCount = 0;
    let lCount = 0;
    let uCount = 0;

    ringLogs.forEach((r) => {
      sumH += Math.abs(r.hLead || 0);
      sumV += Math.abs(r.vLead || 0);
      const dev = Math.hypot(r.hLead || 0, r.vLead || 0);
      if (dev > maxDev) maxDev = dev;
      const type = (r.key || '').charAt(0);
      if (type === 'R') rCount++;
      else if (type === 'L') lCount++;
      else if (type === 'U') uCount++;
    });

    return {
      total,
      avgH: Number((sumH / total).toFixed(2)),
      avgV: Number((sumV / total).toFixed(2)),
      maxDev: Number(maxDev.toFixed(2)),
      rCount,
      lCount,
      uCount,
    };
  }, [ringLogs]);

  // Chart 1: Trajectory Trend (H Lead & V Lead vs Ring Number)
  const trajectoryChartData = useMemo(() => {
    const labels = ringLogs.map((r) => r.ringNum);
    const hData = ringLogs.map((r) => r.hLead);
    const vData = ringLogs.map((r) => r.vLead);

    return {
      labels,
      datasets: [
        {
          label: 'Horizontal Lead (H)',
          data: hData,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#00d4ff',
        },
        {
          label: 'Vertical Lead (V)',
          data: vData,
          borderColor: '#ff5252',
          backgroundColor: 'rgba(255, 82, 82, 0.1)',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#ff5252',
        },
      ],
    };
  }, [ringLogs]);

  // Chart 2: Gap Clearance Trends
  const gapChartData = useMemo(() => {
    const labels = ringLogs.map((r) => r.ringNum);
    return {
      labels,
      datasets: [
        { label: 'Gap Top', data: ringLogs.map((r) => r.gapT || 90), borderColor: '#a855f7', tension: 0.2, pointRadius: 3 },
        { label: 'Gap Bottom', data: ringLogs.map((r) => r.gapB || 90), borderColor: '#eab308', tension: 0.2, pointRadius: 3 },
        { label: 'Gap Left', data: ringLogs.map((r) => r.gapL || 90), borderColor: '#3b82f6', tension: 0.2, pointRadius: 3 },
        { label: 'Gap Right', data: ringLogs.map((r) => r.gapR || 90), borderColor: '#10b981', tension: 0.2, pointRadius: 3 },
      ],
    };
  }, [ringLogs]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e8eaf6', font: { family: 'Space Mono', size: 11 } },
      },
      tooltip: {
        backgroundColor: '#111827',
        titleColor: '#00d4ff',
        bodyColor: '#e8eaf6',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: '#7986a0', font: { size: 10, family: 'Space Mono' } },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        ticks: { color: '#7986a0', font: { size: 10, family: 'Space Mono' } },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surf-2 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              OPERATIONAL MONITOR
            </span>
            <span className="text-xs text-text-muted">MRT Purple Line Tunnel Excavation</span>
          </div>
          <h2 className="text-2xl font-bold text-text tracking-tight">TBM Trajectory & Performance Dashboard</h2>
          <p className="text-sm text-text-muted mt-1">
            Real-time drift tracking, tail clearance health metrics, and key ring segment statistics.
          </p>
        </div>

        {latestRing && (
          <div className="flex items-center gap-4 bg-surf-3 border border-white/10 px-5 py-3 rounded-xl font-mono">
            <div>
              <span className="text-xs text-text-muted uppercase block">Latest Ring</span>
              <span className="text-xl font-black text-acc">{latestRing.ringNum}</span>
            </div>
            <div className="border-l border-white/10 pl-4">
              <span className="text-xs text-text-muted uppercase block">Installed Key</span>
              <span className="text-xl font-black text-emerald-400">{latestRing.key}</span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted uppercase font-mono">Total Rings Completed</span>
            <h3 className="text-3xl font-extrabold font-mono text-text mt-1">{stats.total}</h3>
            <span className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
              <ArrowUpRight size={13} /> Target: 1,440 Rings
            </span>
          </div>
          <div className="p-3 bg-acc/10 border border-acc/20 rounded-xl text-acc">
            <Layers size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted uppercase font-mono">Avg |H Lead| Dev</span>
            <h3 className="text-3xl font-extrabold font-mono text-acc mt-1">{stats.avgH} <span className="text-sm font-normal text-text-muted">mm</span></h3>
            <span className="text-xs text-text-muted">Within &plusmn;50 mm limit</span>
          </div>
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <Compass size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted uppercase font-mono">Avg |V Lead| Dev</span>
            <h3 className="text-3xl font-extrabold font-mono text-rose-400 mt-1">{stats.avgV} <span className="text-sm font-normal text-text-muted">mm</span></h3>
            <span className="text-xs text-text-muted">Within &plusmn;50 mm limit</span>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted uppercase font-mono">Segment Distribution</span>
            <div className="flex gap-2 mt-2 font-mono text-xs">
              <span className="text-rose-400 font-bold">R: {stats.rCount}</span>
              <span className="text-cyan-400 font-bold">L: {stats.lCount}</span>
              <span className="text-amber-400 font-bold">U: {stats.uCount}</span>
            </div>
            <span className="text-xs text-text-muted mt-1 block">Balanced ring mix</span>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Chart Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trajectory Drift Chart (8 cols) */}
        <div className="lg:col-span-8 card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} className="text-acc" /> H Lead & V Lead Trajectory History
              </h3>
              <p className="text-xs text-text-muted">Historical deviation per completed ring in millimeter</p>
            </div>
          </div>

          <div className="h-[320px] w-full pt-2">
            <Line data={trajectoryChartData} options={chartOptions} />
          </div>
        </div>

        {/* Latest Gap Visualizer Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <GapVisualizer
            gapT={latestRing?.gapT || 92}
            gapB={latestRing?.gapB || 90}
            gapL={latestRing?.gapL || 92}
            gapR={latestRing?.gapR || 90}
            editable={false}
          />
        </div>
      </div>

      {/* Second Chart Row */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-text uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-purple-400" /> Tail Clearance Gap Evolution (Top / Bottom / Left / Right)
            </h3>
            <p className="text-xs text-text-muted">Monitoring tail seal clearance trends across rings</p>
          </div>
        </div>

        <div className="h-[260px] w-full pt-2">
          <Line data={gapChartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}

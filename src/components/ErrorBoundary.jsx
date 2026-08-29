import React from 'react';
import { ShieldAlert, RotateCcw, AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TBM Planner App Render Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleClearAndReset = () => {
    try {
      localStorage.removeItem('tbm_horizontal_alignment');
      localStorage.removeItem('tbm_vertical_alignment');
      localStorage.removeItem('tbm_ring_logs');
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-surf-2 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text">พบข้อผิดพลาดในการแสดงผล (Application Error)</h2>
                <p className="text-xs text-text-muted">ระบบตรวจพบข้อผิดพลาดขณะโหลดข้อมูล</p>
              </div>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-3.5 font-mono text-xs text-rose-300 overflow-x-auto max-h-48">
              {this.state.error?.toString()}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn btn-yes px-4 py-2 text-xs font-bold flex items-center gap-2"
              >
                <RotateCcw size={15} /> รีเฟรชหน้าเว็บ (Reload Page)
              </button>

              <button
                type="button"
                onClick={this.handleClearAndReset}
                className="btn btn-outline border-rose-500/40 text-rose-300 hover:bg-rose-500/20 px-4 py-2 text-xs font-bold flex items-center gap-2"
              >
                <AlertTriangle size={15} /> ล้างแคชและรีเซ็ตค่าเริ่มต้น (Clear Cache & Reset)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

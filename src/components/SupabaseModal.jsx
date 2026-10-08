import { Dialog } from './PlannerUI';
import { measuredLogs } from '../services/decisionSupport';
import { useState } from 'react';
import { Cloud, CloudCheck, CloudOff, Database, Link2, CheckCircle2, AlertTriangle, X, Copy, Check, ExternalLink, RotateCw, UploadCloud, DownloadCloud, Sparkles, Info, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../services/supabaseClient';
import { batchSaveRingLogsToCloud, saveAlignmentToCloud, fetchRingLogsFromCloud } from '../services/supabaseService';
import { supabaseProjectDashboardUrl } from '../services/supabaseDiagnostics';

export default function SupabaseModal({
  isOpen,
  onClose,
  ringLogs = [],
  onSyncRingLogs = () => {},
  onConnectionChange = () => {}
}) {
  const [url, setUrl] = useState(() => getSupabaseConfig().url);
  const [anonKey, setAnonKey] = useState(() => getSupabaseConfig().anonKey);
  const [showKey, setShowKey] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('connect'); // 'connect' | 'sql' | 'guide'

  const [testStatus, setTestStatus] = useState(null); // { loading, success, message, tableMissing }
  const [syncStatus, setSyncStatus] = useState(null); // { loading, success, message }
  const [isCopiedSQL, setIsCopiedSQL] = useState(false);

  const uploadRecords = measuredLogs(ringLogs);
  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestStatus({ loading: true, message: 'กำลังทดสอบการเชื่อมต่อฐานข้อมูล...' });
    const res = await testSupabaseConnection(url, anonKey);
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.message,
      tableMissing: res.tableMissing
    });
  };

  const handleSaveAndConnect = async () => {
    setTestStatus({ loading: true, message: 'กำลังทดสอบก่อนบันทึกการเชื่อมต่อ...' });
    const res = await testSupabaseConnection(url, anonKey);
    if (res.success && !saveSupabaseConfig(url, anonKey)) {
      setTestStatus({loading:false,success:false,message:'บันทึกค่าการเชื่อมต่อในเครื่องไม่สำเร็จ'});
      return;
    }
    setTestStatus({
      loading: false,
      success: res.success,
      message: res.message,
      tableMissing: res.tableMissing
    });

    if (res.success) {
      onConnectionChange(true);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('คุณต้องการตัดการเชื่อมต่อกับ Supabase และกลับไปใช้ Local Storage หรือไม่?')) {
      saveSupabaseConfig('', '');
      setUrl('');
      setAnonKey('');
      setTestStatus(null);
      onConnectionChange(false);
    }
  };

  // Upload all local ring logs & alignment to cloud
  const handleUploadAllToCloud = async () => {
    if (!url || !anonKey) {
      alert('กรุณาเชื่อมต่อ Supabase ก่อนทำการอัปโหลด');
      return;
    }

    const savedConfig = getSupabaseConfig();
    if(savedConfig.url !== url.trim() || savedConfig.anonKey !== anonKey.trim()) { setSyncStatus({success:false,message:'บันทึกและทดสอบการเชื่อมต่อก่อนอัปโหลด'}); return; }
    setSyncStatus({ loading: true, message: `กำลังอัปโหลด ${uploadRecords.length} ริงขึ้น Cloud...` });

    try {
      // 1. Upload rings
      if (uploadRecords.length > 0) {
        const ringRes = await batchSaveRingLogsToCloud(uploadRecords);
        if (ringRes.error) throw new Error(ringRes.error);
      }

      // 2. Upload horizontal & vertical alignments
      const savedH = localStorage.getItem('tbm_horizontal_alignment');
      const savedV = localStorage.getItem('tbm_vertical_alignment');
      const hData = savedH ? JSON.parse(savedH) : [];
      const vData = savedV ? JSON.parse(savedV) : [];

      await saveAlignmentToCloud(hData, vData);

      setSyncStatus({
        loading: false,
        success: true,
        message: `อัปโหลด ${uploadRecords.length} ริง และแนว Alignment ขึ้น Supabase Cloud สำเร็จเรียบร้อย!`
      });
    } catch (e) {
      setSyncStatus({ loading: false, success: false, message: `Upload Failed: ${e.message}` });
    }
  };

  // Pull all ring logs from cloud
  const handlePullFromCloud = async () => {
    setSyncStatus({ loading: true, message: 'กำลังดึงข้อมูลจาก Cloud...' });
    const res = await fetchRingLogsFromCloud();
    if (res.error) {
      setSyncStatus({ loading: false, success: false, message: res.error });
      return;
    }

    if (res.data) {
      onSyncRingLogs(res.data);
      setSyncStatus({
        loading: false,
        success: true,
        message: `ดึงข้อมูลสำเร็จ! ซิงก์ประวัติ ${res.data.length} ริงจาก Cloud ลงเครื่องเรียบร้อย`
      });
    }
  };

  const sqlSchemaText = `-- ============================================================================
-- TBM PLANNER: SUPABASE DATABASE SCHEMA (100% FREE TIER READY)
-- MRT Purple Line Project / MWA-9D TBM#34
-- ============================================================================

-- 1. Create table for Ring Logs & Drive History
CREATE TABLE IF NOT EXISTS public.ring_logs (
    id BIGSERIAL PRIMARY KEY,
    ring_number INT NOT NULL UNIQUE,
    ring_num_str TEXT,
    sta TEXT,
    dist NUMERIC,
    section_code TEXT,
    key_position TEXT NOT NULL,
    prev_key TEXT,
    segment_type TEXT NOT NULL,
    segment_size INT DEFAULT 1200,
    h_lead NUMERIC DEFAULT 0,
    v_plumb NUMERIC DEFAULT 0,
    lead_req NUMERIC DEFAULT 0,
    after_h NUMERIC DEFAULT 0,
    after_v NUMERIC DEFAULT 0,
    deviation_mm NUMERIC DEFAULT 0,
    suitability TEXT DEFAULT 'Yes',
    gap_top NUMERIC DEFAULT 90,
    gap_bottom NUMERIC DEFAULT 90,
    gap_left NUMERIC DEFAULT 90,
    gap_right NUMERIC DEFAULT 90,
    roll NUMERIC DEFAULT 0,
    pitch NUMERIC DEFAULT 0,
    yaw NUMERIC DEFAULT 0,
    thrust_force NUMERIC DEFAULT 0,
    torque NUMERIC DEFAULT 0,
    excavation_date TIMESTAMPTZ DEFAULT NOW(),
    operator_name TEXT DEFAULT 'Chief Engineer',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table for Horizontal Alignment Sections
CREATE TABLE IF NOT EXISTS public.horizontal_alignment (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    section_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    start_sta TEXT NOT NULL,
    end_sta TEXT NOT NULL,
    radius NUMERIC DEFAULT 180,
    ratio JSONB DEFAULT '{"un": 1, "rt": 1, "lt": 1}'::jsonb,
    allowed_types JSONB DEFAULT '["U", "R", "L"]'::jsonb,
    sequence_order INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create table for Vertical Alignment Profile
CREATE TABLE IF NOT EXISTS public.vertical_alignment (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    start_sta TEXT NOT NULL,
    end_sta TEXT NOT NULL,
    start_elev NUMERIC DEFAULT 0,
    end_elev NUMERIC DEFAULT 0,
    grade_pct NUMERIC DEFAULT 0,
    curve_type TEXT DEFAULT 'constant_grade',
    radius_v NUMERIC DEFAULT 0,
    length_v NUMERIC DEFAULT 0,
    sequence_order INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create table for Consumables & Polymer Logs
CREATE TABLE IF NOT EXISTS public.consumables_logs (
    id BIGSERIAL PRIMARY KEY,
    ring_number INT NOT NULL,
    foam_liters NUMERIC DEFAULT 0,
    polymer_kg NUMERIC DEFAULT 0,
    bentonite_m3 NUMERIC DEFAULT 0,
    grout_liters NUMERIC DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.ring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horizontal_alignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_alignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumables_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create Public Access Policies
CREATE POLICY "Allow public read ring_logs" ON public.ring_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert ring_logs" ON public.ring_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update ring_logs" ON public.ring_logs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete ring_logs" ON public.ring_logs FOR DELETE USING (true);

CREATE POLICY "Allow public read horizontal_alignment" ON public.horizontal_alignment FOR SELECT USING (true);
CREATE POLICY "Allow public all horizontal_alignment" ON public.horizontal_alignment FOR ALL USING (true);

CREATE POLICY "Allow public read vertical_alignment" ON public.vertical_alignment FOR SELECT USING (true);
CREATE POLICY "Allow public all vertical_alignment" ON public.vertical_alignment FOR ALL USING (true);

CREATE POLICY "Allow public read consumables_logs" ON public.consumables_logs FOR SELECT USING (true);
CREATE POLICY "Allow public all consumables_logs" ON public.consumables_logs FOR ALL USING (true);

-- 7. Enable Realtime Publications
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.ring_logs,
    public.horizontal_alignment,
    public.vertical_alignment;
COMMIT;`;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    setIsCopiedSQL(true);
    setTimeout(() => setIsCopiedSQL(false), 3000);
  };

  const isConfigured = Boolean(url && anonKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <Dialog label="ตั้งค่าฐานข้อมูล Cloud" onClose={onClose} busy={testStatus?.loading||syncStatus?.loading} className="bg-surf-2 border border-white/15 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-surf-3/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Cloud size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text">ตั้งค่าฐานข้อมูลออนไลน์ (Supabase Cloud)</h3>
                {isConfigured ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ตั้งค่าแล้ว
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-text-muted">
                    Local Storage Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                ฐานข้อมูล PostgreSQL Cloud ฟรี 100% ตลอดชีพ พร้อมระบบ Live Sync เรียลไทม์
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-white/10 bg-surf-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveSubTab('connect')}
            className={`pb-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'connect'
                ? 'border-acc text-acc'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Link2 size={14} /> เชื่อมต่อฐานข้อมูล
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('sql')}
            className={`pb-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'sql'
                ? 'border-acc text-acc'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Database size={14} /> คำสั่ง SQL Schema
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('guide')}
            className={`pb-2.5 px-3 border-b-2 font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'guide'
                ? 'border-acc text-acc'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Info size={14} /> ขั้นตอนการสร้าง (3 นาที)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: Connect Form */}
          {activeSubTab === 'connect' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="text-text-muted flex items-center justify-between">
                  <span>Supabase Project URL</span>
                  <a
                    href={supabaseProjectDashboardUrl(url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-acc flex items-center gap-1 text-[11px] hover:underline"
                  >
                    เปิด Supabase Dashboard <ExternalLink size={11} />
                  </a>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xyzabcdefghijklmnop.supabase.co"
                    className="w-full bg-surf-3 border border-white/10 rounded-xl px-3.5 py-2.5 text-text outline-none focus:border-acc font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-text-muted block">Supabase Project API Key (Anon / Public Key)</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-surf-3 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-text outline-none focus:border-acc font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {testStatus && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-sans ${
                    testStatus.loading
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                      : testStatus.success
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testStatus.loading ? (
                    <RotateCw size={16} className="animate-spin shrink-0 mt-0.5" />
                  ) : testStatus.success ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span>{testStatus.message}</span>
                    {testStatus.tableMissing && (
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('sql')}
                        className="block mt-1.5 text-acc font-bold hover:underline"
                      >
                        👉 คลิกที่นี่เพื่อเปิดแท็บ SQL Schema แล้วนำไปรันใน Supabase
                      </button>
                    )}
                    {!testStatus.loading && !testStatus.success && !testStatus.tableMissing && <a href={supabaseProjectDashboardUrl(url)} target="_blank" rel="noreferrer" className="block mt-1.5 text-acc font-bold hover:underline">ตรวจสถานะโครงการใน Supabase Dashboard ↗</a>}
                  </div>
                </div>
              )}

              {/* Sync Status Message */}
              {syncStatus && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-sans ${
                    syncStatus.loading
                      ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                      : syncStatus.success
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {syncStatus.loading ? (
                    <RotateCw size={16} className="animate-spin shrink-0" />
                  ) : syncStatus.success ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  )}
                  <span>{syncStatus.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={!url || !anonKey}
                  className="btn btn-outline py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RotateCw size={14} /> ทดสอบการเชื่อมต่อ
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndConnect}
                  disabled={!url || !anonKey}
                  className="btn btn-yes py-2 px-4 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 shadow-lg"
                >
                  <CloudCheck size={16} /> บันทึกและเชื่อมต่อ Cloud
                </button>

                {isConfigured && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="btn btn-outline border-rose-500/30 text-rose-400 hover:bg-rose-500/15 py-2 px-3 text-xs"
                  >
                    <CloudOff size={14} /> ตัดการเชื่อมต่อ
                  </button>
                )}
              </div>

              {/* Cloud Sync Tools (When Connected) */}
              {isConfigured && (
                <div className="p-4 bg-surf-3/60 rounded-xl border border-white/5 space-y-2.5 pt-3">
                  <span className="font-bold text-text text-xs uppercase flex items-center gap-1.5 font-sans">
                    <Sparkles size={14} className="text-acc" /> เครื่องมือซิงก์ข้อมูลระหว่างเครื่องกับ Cloud:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleUploadAllToCloud}
                      className="p-2.5 rounded-xl bg-surf-2 border border-white/10 hover:border-acc/40 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="p-2 rounded-lg bg-acc/10 text-acc group-hover:bg-acc group-hover:text-black transition-colors">
                        <UploadCloud size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-text block text-xs">อัปโหลดข้อมูลขึ้น Cloud</span>
                        <span className="text-[10px] text-text-muted block">ส่งข้อมูลสนาม {uploadRecords.length} ริง & Alignment ขึ้น Supabase</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handlePullFromCloud}
                      className="p-2.5 rounded-xl bg-surf-2 border border-white/10 hover:border-acc/40 text-left transition-all flex items-center gap-3 group"
                    >
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-black transition-colors">
                        <DownloadCloud size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-text block text-xs">ดึงข้อมูลทั้งหมดจาก Cloud</span>
                        <span className="text-[10px] text-text-muted block">ซิงก์ประวัติริงจากเครื่องเพื่อนร่วมงาน</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SQL Schema */}
          {activeSubTab === 'sql' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between bg-surf-3 p-3 rounded-xl border border-white/5">
                <span className="text-text-muted text-[11px]">
                  นำโค้ด SQL ด้านล่างไปรันในเมนู <strong>SQL Editor</strong> บนหน้าเว็บ Supabase
                </span>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className={`btn py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isCopiedSQL ? 'bg-emerald-500 text-black' : 'bg-acc text-black hover:bg-cyan-300'
                  }`}
                >
                  {isCopiedSQL ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isCopiedSQL ? 'คัดลอกแล้ว!' : 'คัดลอก SQL Schema'}</span>
                </button>
              </div>

              <div className="bg-black/70 border border-white/10 rounded-xl p-3.5 max-h-72 overflow-y-auto text-[11px] text-cyan-300 leading-relaxed font-mono">
                <pre>{sqlSchemaText}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: Quick Guide */}
          {activeSubTab === 'guide' && (
            <div className="space-y-3 text-xs leading-relaxed font-sans text-text-muted">
              <div className="p-3.5 bg-surf-3/60 rounded-xl border border-white/5 space-y-1.5">
                <span className="font-bold text-acc block text-sm">ขั้นตอนที่ 1: สมัครบัญชี Supabase (ฟรี)</span>
                <p>
                  เข้าเว็บไซต์ <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-acc underline font-bold">supabase.com</a> แล้วกด <strong>Sign Up with GitHub / Google</strong> จากนั้นกดปุ่ม <strong>+ New Project</strong> (ตั้งชื่อโปรเจกต์เช่น `tbm-mrt-purple-line` และตั้งรหัสผ่าน Database)
                </p>
              </div>

              <div className="p-3.5 bg-surf-3/60 rounded-xl border border-white/5 space-y-1.5">
                <span className="font-bold text-purple-300 block text-sm">ขั้นตอนที่ 2: รันคำสั่งสร้างตาราง (SQL Editor)</span>
                <p>
                  ในหน้าเว็บ Supabase แถบเมนูด้านซ้าย ให้คลิกที่ <strong>SQL Editor</strong> &rarr; กดปุ่ม <strong>+ New Query</strong> &rarr; ก๊อปปี้โค้ดในแท็บ <strong>คำสั่ง SQL Schema</strong> ของโปรแกรมนี้ไปวาง &rarr; กดปุ่ม <strong>Run</strong> สีเขียว
                </p>
              </div>

              <div className="p-3.5 bg-surf-3/60 rounded-xl border border-white/5 space-y-1.5">
                <span className="font-bold text-emerald-300 block text-sm">ขั้นตอนที่ 3: ก๊อปปี้ Project URL & API Key มาวาง</span>
                <p>
                  ในหน้าเว็บ Supabase เมนูด้านซ้ายล่างสุด คลิกที่ <strong>Project Settings &rarr; Data API (หรือ API)</strong> &rarr; ก๊อปปี้ <strong>Project URL</strong> และ <strong>anon / public key</strong> มาใส่ในแท็บเชื่อมต่อของโปรแกรมนี้ แล้วกดปุ่ม <strong>บันทึกและเชื่อมต่อ Cloud</strong> ได้ทันที!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-surf-3/40 flex items-center justify-between text-xs font-mono">
          <span className="text-text-muted text-[11px] flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-400" /> ข้อมูลเข้ารหัสผ่าน HTTPS SSL ตลอดการส่ง
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline py-1.5 px-4 text-xs font-bold"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </Dialog>
    </div>
  );
}

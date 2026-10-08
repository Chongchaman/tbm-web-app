import { useState } from 'react';
import { Cloud, CloudOff, DownloadCloud, ExternalLink, UploadCloud, X } from 'lucide-react';
import {
  connectSheets, disconnectSheets, fetchProjectState, fetchSheetSnapshot,
  flushPendingProjectState, flushPendingRecords, getSheetsConfig, isSheetsConnected, pendingCount,
  queueRecordChanges, restoreProjectState, saveSheetsConfig, uploadProjectState,
} from '../services/googleSheetsService';
import { recordIdentity } from '../services/recordIdentity';
import { recordKind } from '../services/decisionSupport';

export default function GoogleSheetsModal({ onClose, onConnectionChange, ringLogs, plans }) {
  const [config, setConfig] = useState(getSheetsConfig);
  const [connected, setConnected] = useState(isSheetsConnected);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sheetUrl = track => `https://docs.google.com/spreadsheets/d/${track === 'WB' ? config.sheetIdWB : config.sheetIdEB}/edit`;

  async function perform(action) {
    setWorking(true); setError(''); setMessage('');
    try { await action(); }
    catch (failure) { setError(failure.message || 'ดำเนินการไม่สำเร็จ'); }
    finally { setWorking(false); }
  }

  const connect = () => perform(async () => {
    const saved = saveSheetsConfig(config);
    setConfig(saved);
    await connectSheets(saved);
    setConnected(true);
    onConnectionChange(true);
    if (localStorage.getItem('tbm_google_sheets_migrated') === '1') {
      const [recordCount, stateCount] = await Promise.all([flushPendingRecords(), flushPendingProjectState()]);
      setMessage(`เชื่อมต่อทั้งสองชีตแล้ว · ส่งรายการค้าง ${recordCount} ริง และข้อมูลตั้งค่า ${stateCount} รายการ`);
    } else {
      const [snapshot, state] = await Promise.all([fetchSheetSnapshot(), fetchProjectState()]);
      if (!snapshot.records.length && !state) {
        queueRecordChanges([...ringLogs, ...plans], 'save');
        const count = await flushPendingRecords();
        await uploadProjectState();
        setMessage(`สร้างข้อมูลเริ่มต้นในสองชีตแล้ว · ย้าย ${count} ริง`);
      } else setMessage('เชื่อมต่อแล้ว มีข้อมูลในชีตอยู่ก่อน กรุณาเลือกอัปโหลดข้อมูลในเครื่องหรือดึงข้อมูลจากชีต');
    }
  });

  const upload = () => perform(async () => {
    queueRecordChanges([...ringLogs, ...plans], 'save');
    const count = await flushPendingRecords();
    await uploadProjectState();
    setMessage(`ส่งข้อมูลริง ${count} รายการ พร้อมแนวอุโมงค์และค่าตั้งค่าไปยังชีตแล้ว`);
  });

  const pull = () => perform(async () => {
    await flushPendingRecords();
    const [snapshot, state] = await Promise.all([fetchSheetSnapshot(), fetchProjectState()]);
    if (!snapshot.records.length && !snapshot.deletedIds.length && !state) { setMessage('ชีตยังไม่มีข้อมูลสำหรับดึง'); return; }
    const merged = new Map([...ringLogs, ...plans].map(record => [recordIdentity(record), record]));
    for (const id of snapshot.deletedIds) merged.delete(id);
    for (const record of snapshot.records) merged.set(recordIdentity(record), record);
    const all = [...merged.values()];
    localStorage.setItem('tbm_sheet_before_pull_records', JSON.stringify({ savedAt: new Date().toISOString(), ringLogs, plans }));
    localStorage.setItem('tbm_ring_logs', JSON.stringify(all.filter(record => recordKind(record) !== 'planned')));
    localStorage.setItem('tbm_saved_plans', JSON.stringify(all.filter(record => recordKind(record) === 'planned')));
    if (state) restoreProjectState(state);
    localStorage.setItem('tbm_google_sheets_migrated', '1');
    window.location.reload();
  });

  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog sheets-dialog" role="dialog" aria-modal="true" aria-labelledby="sheets-title">
      <div className="sheets-header"><div><span className="eyebrow">PROJECT DATABASE</span><h2 id="sheets-title">Google Sheets · 2 เครื่อง</h2><p>TBM1 / E/B และ TBM2 / W/B แยกข้อมูลริงและแผนคนละชีต</p></div><button className="icon-button" aria-label="ปิด" onClick={onClose}><X size={18}/></button></div>
      <div className={`sheets-status ${connected ? 'is-connected' : ''}`}>{connected ? <Cloud size={18}/> : <CloudOff size={18}/>}<div><strong>{connected ? 'เชื่อมต่อในครั้งนี้แล้ว' : 'กำลังใช้ข้อมูลในเครื่อง'}</strong><small>{connected ? `รายการรอซิงก์ ${pendingCount()} รายการ` : 'ลงชื่อเข้าใช้ Google เพื่ออ่านและบันทึกชีต'}</small></div></div>
      <div className="sheets-fields">
        <label>TBM1 · E/B Google Sheet<input value={config.sheetIdEB} onChange={event => setConfig(previous => ({ ...previous, sheetIdEB: event.target.value }))} disabled={working || connected} /></label>
        <label>TBM2 · W/B Google Sheet<input value={config.sheetIdWB} onChange={event => setConfig(previous => ({ ...previous, sheetIdWB: event.target.value }))} disabled={working || connected} /></label>
        <label>OAuth Client ID<input value={config.clientId} onChange={event => setConfig(previous => ({ ...previous, clientId: event.target.value }))} disabled={working || connected} placeholder="…apps.googleusercontent.com" /></label>
      </div>
      <div className="sheets-links"><a href={sheetUrl('EB')} target="_blank" rel="noreferrer"><ExternalLink size={15}/> เปิดชีต TBM1</a><a href={sheetUrl('WB')} target="_blank" rel="noreferrer"><ExternalLink size={15}/> เปิดชีต TBM2</a><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer"><ExternalLink size={15}/> สร้าง OAuth Client ID</a></div>
      {!config.clientId && <p className="sheets-help">ตั้งค่าใน Google Cloud: เปิด Sheets API, ตั้งค่า OAuth consent screen, สร้าง OAuth client ประเภท Web application แล้วเพิ่ม Authorized JavaScript origin เป็น <code>{window.location.origin}</code> จากนั้นนำ Client ID มาวางที่นี่ ผู้ใช้คนอื่นต้องได้รับสิทธิ์แก้ชีตด้วย</p>}
      {error && <div className="sheets-message is-error" role="alert">{error}</div>}
      {message && <div className="sheets-message" role="status">{message}</div>}
      <div className="sheets-actions">
        {!connected ? <button className="btn" disabled={working} onClick={connect}><Cloud size={17}/> ลงชื่อเข้าใช้ Google</button> : <>
          <button className="btn" disabled={working} onClick={upload}><UploadCloud size={17}/> อัปโหลดข้อมูลในเครื่อง</button>
          <button className="btn btn-outline" disabled={working} onClick={pull}><DownloadCloud size={17}/> ดึงข้อมูลจากชีต</button>
          <button className="btn btn-outline" disabled={working} onClick={() => { disconnectSheets(); setConnected(false); onConnectionChange(false); setMessage('ออกจากการเชื่อมต่อแล้ว'); }}>ตัดการเชื่อมต่อ</button>
        </>}
      </div>
      <p className="sheets-footnote">เว็บบันทึกในเครื่องก่อนเสมอ ถ้าชีตยังว่าง ระบบจะย้ายข้อมูลเริ่มต้นให้อัตโนมัติ หากชีตมีข้อมูลอยู่แล้วให้เลือกว่าจะอัปโหลดหรือดึงก่อนซิงก์ต่อ</p>
    </section>
  </div>;
}

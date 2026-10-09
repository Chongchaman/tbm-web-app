import { useState } from 'react';
import { Cloud, CloudOff, DownloadCloud, RefreshCw, UploadCloud, X } from 'lucide-react';
import {
  connectCloud, fetchCloudSnapshot, flushPendingRecords,
  isCloudConnected, markCloudMigrated, pendingCount, queueRecordChanges,
  restoreProjectState, uploadProjectState,
} from '../services/cloudDatabaseService';
import { recordKind } from '../services/decisionSupport';

export default function CloudDatabaseModal({ onClose, onConnectionChange, ringLogs, plans }) {
  const [connected, setConnected] = useState(isCloudConnected);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function perform(action) {
    setWorking(true); setError(''); setMessage('');
    try { await action(); }
    catch (failure) { setError(failure.message || 'ดำเนินการไม่สำเร็จ'); }
    finally { setWorking(false); }
  }

  const reconnect = () => perform(async () => {
    await connectCloud();
    setConnected(true); onConnectionChange(true);
    const snapshot = await fetchCloudSnapshot({ force: true });
    setMessage(snapshot.initialized ? `เชื่อมต่อ D1 แล้ว · พบข้อมูล ${snapshot.records.length} รายการ` : 'เชื่อมต่อ D1 แล้ว · ฐานข้อมูลยังว่าง');
  });

  const upload = () => perform(async () => {
    queueRecordChanges([...ringLogs, ...plans], 'save');
    const recordCount = await flushPendingRecords();
    const stateCount = await uploadProjectState();
    markCloudMigrated(); setConnected(true); onConnectionChange(true);
    setMessage(`ย้ายข้อมูลขึ้น D1 แล้ว · ริงและแผน ${recordCount} รายการ · ค่าตั้งโครงการ ${stateCount} รายการ`);
  });

  const pull = () => perform(async () => {
    const snapshot = await fetchCloudSnapshot({ force: true });
    if (!snapshot.initialized) { setMessage('ฐานข้อมูล D1 ยังไม่มีข้อมูล'); return; }
    localStorage.setItem('tbm_cloud_before_pull_records', JSON.stringify({ savedAt: new Date().toISOString(), ringLogs, plans }));
    localStorage.setItem('tbm_ring_logs', JSON.stringify(snapshot.records.filter(record => recordKind(record) !== 'planned')));
    localStorage.setItem('tbm_saved_plans', JSON.stringify(snapshot.records.filter(record => recordKind(record) === 'planned')));
    restoreProjectState(snapshot.state);
    window.location.reload();
  });

  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="dialog sheets-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-title">
      <div className="sheets-header"><div><span className="eyebrow">PROJECT DATABASE</span><h2 id="cloud-title">Cloudflare D1 · ฐานกลาง</h2><p>TBM1 / E/B และ TBM2 / W/B แยกข้อมูลชัดเจนในฐานเดียว</p></div><button className="icon-button" aria-label="ปิด" onClick={onClose}><X size={18}/></button></div>
      <div className={`sheets-status ${connected ? 'is-connected' : ''}`}>{connected ? <Cloud size={18}/> : <CloudOff size={18}/>}<div><strong>{connected ? 'เชื่อมต่อฐานข้อมูลแล้ว' : 'กำลังใช้ข้อมูลสำรองในเครื่อง'}</strong><small>{connected ? `ซิงก์อัตโนมัติทุกประมาณ 3 วินาที · รอส่ง ${pendingCount()} รายการ` : 'ข้อมูลในเครื่องยังอยู่และจะส่งเมื่อเชื่อมต่อได้'}</small></div></div>
      {error && <div className="sheets-message is-error" role="alert">{error}</div>}
      {message && <div className="sheets-message" role="status">{message}</div>}
      <div className="sheets-actions">
        <button className="btn btn-outline" disabled={working} onClick={reconnect}><RefreshCw size={17}/> ตรวจการเชื่อมต่อ</button>
        <button className="btn" disabled={working || !connected} onClick={upload}><UploadCloud size={17}/> ส่งข้อมูลเครื่องนี้ขึ้น D1</button>
        <button className="btn btn-outline" disabled={working || !connected} onClick={pull}><DownloadCloud size={17}/> ดึงข้อมูลล่าสุดจาก D1</button>
      </div>
      <p className="sheets-help">D1 เป็นฐานข้อมูลกลางของโครงการ การเพิ่ม แก้ไข และลบจากเว็บจะส่งทันที อุปกรณ์อื่นจะตรวจเลขรุ่นขนาดเล็กก่อนและดึงตารางใหม่เฉพาะเมื่อข้อมูลเปลี่ยน จึงเร็วและใช้โควตาน้อยกว่าอ่านทั้ง Google Sheet ทุกครั้ง</p>
      <p className="sheets-footnote">เว็บยังเก็บสำเนาในเบราว์เซอร์เพื่อทำงานต่อเมื่ออินเทอร์เน็ตสะดุด รายการที่ยังส่งไม่สำเร็จจะค้างในคิวและส่งใหม่อัตโนมัติ</p>
    </section>
  </div>;
}

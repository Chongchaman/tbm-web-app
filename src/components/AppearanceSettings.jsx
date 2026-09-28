import { useState } from 'react';
import { X, HardHat, Compass, Building2, Palette, Save } from 'lucide-react';
import { Dialog, Field, ValidationErrors } from './PlannerUI';
import { DEFAULT_APPEARANCE, COLOR_PRESETS, appearanceTokens, normalizeAppearance } from '../services/appearance';

const icons = { hardhat:HardHat, compass:Compass, building:Building2 };
export default function AppearanceSettings({ settings, onSave, onClose }) {
  const [draft,setDraft] = useState(settings);
  const [error,setError] = useState('');
  const update = (key,value) => {setDraft(previous => ({...previous,[key]:value}));setError('');};
  const BrandIcon=icons[draft.brandIcon];
  const save = event => {
    event.preventDefault();
    if (!draft.projectName.trim() || !draft.appName.trim() || !draft.projectDetail.trim()) {setError('กรอกชื่อโครงการ ชื่อบนเมนู และรหัสโครงการ / เครื่อง TBM ให้ครบ');return;}
    if (!/^#[0-9a-f]{6}$/i.test(draft.accent)) {setError('รหัสสีต้องเป็น # ตามด้วยตัวเลขหรือตัวอักษร A–F จำนวน 6 ตัว เช่น #175db3');return;}
    try {onSave(normalizeAppearance(draft));onClose();} catch {setError('บันทึกการตั้งค่าไม่ได้ พื้นที่ในเบราว์เซอร์อาจเต็ม กรุณาลองอีกครั้ง');}
  };
  return <div className="dialog-backdrop"><Dialog className="dialog appearance-dialog" label="ตั้งค่าโครงการและหน้าตา" onClose={onClose}>
    <form onSubmit={save}>
      <div className="section-heading"><div><h2>ตั้งค่าโครงการและหน้าตา</h2><p className="section-note">ดูตัวอย่างก่อนบันทึก · จำค่าเฉพาะเบราว์เซอร์นี้</p></div><button className="icon-button" type="button" aria-label="ปิดการตั้งค่า" onClick={onClose}><X size={18}/></button></div>
      <div className="settings-layout"><div className="stack settings-fields">
        <fieldset><legend>ข้อมูลโครงการ</legend><div className="stack">
          <Field label="ชื่อโครงการ"><input value={draft.projectName} maxLength={100} onChange={event=>update('projectName',event.target.value)} /></Field>
          <Field label="รหัสโครงการ / เครื่อง TBM"><input value={draft.projectDetail} maxLength={100} onChange={event=>update('projectDetail',event.target.value)} /></Field>
          <Field label="ชื่อบนเมนู"><input value={draft.appName} maxLength={40} onChange={event=>update('appName',event.target.value)} /></Field>
        </div></fieldset>
        <fieldset><legend>สีและการตกแต่ง</legend><div className="stack">
          <Field label="ธีม"><select value={draft.theme} onChange={event=>update('theme',event.target.value)}><option value="light">สว่าง</option><option value="dark">มืด</option></select></Field>
          <div><span className="settings-label">สีสำเร็จรูป</span><div className="color-presets">{COLOR_PRESETS.map(preset=><button type="button" key={preset.color} aria-label={`เลือกสี${preset.name}`} aria-pressed={draft.accent.toLowerCase()===preset.color} onClick={()=>update('accent',preset.color)}><span style={{background:preset.color}} />{preset.name}</button>)}</div></div>
          <div className="custom-color"><Field label="เลือกสีเอง"><input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.accent)?draft.accent:DEFAULT_APPEARANCE.accent} onChange={event=>update('accent',event.target.value)} /></Field><Field label="รหัสสี"><input value={draft.accent} maxLength={7} spellCheck={false} onChange={event=>update('accent',event.target.value)} /></Field></div>
          <p className="section-note">เว็บปรับความเข้มสีสำหรับข้อความและปุ่มให้อ่านชัด สีสถานะเตือนยังใช้ความหมายเดิม</p>
          <div className="form-grid"><Field label="พื้นหลัง"><select value={draft.background} onChange={event=>update('background',event.target.value)}><option value="plain">เรียบ</option><option value="tinted">สีอ่อนตามธีม</option><option value="gradient">ไล่สี</option></select></Field><Field label="มุมการ์ด"><select value={draft.corners} onChange={event=>update('corners',event.target.value)}><option value="square">เหลี่ยมมนเล็กน้อย</option><option value="rounded">มนมาตรฐาน</option><option value="soft">มนมาก</option></select></Field><Field label="เงาการ์ด"><select value={draft.shadow} onChange={event=>update('shadow',event.target.value)}><option value="none">เรียบไม่มีเงา</option><option value="soft">เงาบาง</option></select></Field><Field label="ไอคอนโครงการ"><select value={draft.brandIcon} onChange={event=>update('brandIcon',event.target.value)}><option value="hardhat">หมวกนิรภัย</option><option value="compass">เข็มทิศ</option><option value="building">อาคาร</option></select></Field></div>
        </div></fieldset>
        <fieldset><legend>ตัวอักษรและระยะห่าง</legend><div className="form-grid">
          <Field label="ฟอนต์"><select value={draft.fontFamily} onChange={event=>update('fontFamily',event.target.value)}>{[['sarabun','Sarabun'],['prompt','Prompt'],['noto','Noto Sans Thai'],['kanit','Kanit'],['chakra','Chakra Petch'],['mitr','Mitr']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field>
          <Field label="ขนาดข้อความ"><select value={draft.fontSize} onChange={event=>update('fontSize',event.target.value)}>{[['sm','กระชับ'],['md','มาตรฐาน'],['lg','ใหญ่'],['xl','ใหญ่พิเศษ']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field>
          <Field label="ระยะห่าง"><select value={draft.density} onChange={event=>update('density',event.target.value)}><option value="comfortable">อ่านสบาย</option><option value="compact">กระชับ</option></select></Field>
        </div></fieldset>
      </div><aside className="settings-preview" data-theme={draft.theme} data-font-family={draft.fontFamily} data-font-size={draft.fontSize} data-density={draft.density} style={appearanceTokens(draft)} aria-label="ตัวอย่างหน้าตา">
        <span className="eyebrow"><Palette size={15}/> ตัวอย่าง</span><div className="preview-brand"><span className="brand-icon"><BrandIcon size={24}/></span><div><strong>{draft.appName || 'ชื่อบนเมนู'}</strong><small>{draft.projectDetail || 'รหัสโครงการ / เครื่อง TBM'}</small></div></div>
        <h3>{draft.projectName || 'ชื่อโครงการ'}</h3><p>ภาพรวมและการวางแผนริง</p><div className="preview-card"><span>แผนที่เลือก</span><strong>R0128 · U4</strong><span className="preview-tag">วางแผนแนวอุโมงค์</span><div className="preview-button">คำนวณแผน</div></div>
        <p className="section-note">การเปลี่ยนชื่อเป็นชื่อที่แสดงในเว็บ ข้อมูลแนวและริงใช้ชุดเดิม</p>
      </aside></div>
      <ValidationErrors errors={error?[error]:[]} />
      <div className="settings-actions"><button className="btn btn-outline" type="button" onClick={()=>{setDraft({...DEFAULT_APPEARANCE});setError('');}}>คืนค่าเริ่มต้นในฟอร์ม</button><div className="page-actions"><button className="btn" type="button" onClick={onClose}>ยกเลิก</button><button className="btn btn-acc" type="submit"><Save size={17}/> บันทึกการตั้งค่า</button></div></div>
    </form>
  </Dialog></div>;
}

import { useEffect, useState } from 'react';
import { Eye, EyeOff, HardHat, LoaderCircle, LockKeyhole, LogIn } from 'lucide-react';

export default function AuthGate({ children }) {
  const [status, setStatus] = useState(import.meta.env.DEV ? 'authenticated' : 'checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (import.meta.env.DEV) return undefined;
    let active = true;
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => {
        if (!active) return;
        setStatus(response.ok ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (!active) return;
        setStatus('anonymous');
        setMessage('ติดต่อระบบเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      });
    return () => { active = false; };
  }, []);

  const login = async event => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
      setPassword('');
      setStatus('authenticated');
    } catch (error) {
      setStatus('anonymous');
      setMessage(error.message);
    }
  };

  if (status === 'authenticated') return children;
  if (status === 'checking') return <main className="auth-screen"><div className="auth-loading" role="status"><LoaderCircle className="spin" size={28}/><span>กำลังตรวจสอบการเข้าสู่ระบบ…</span></div></main>;

  return <main className="auth-screen">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-brand"><span><HardHat size={26}/></span><div><small>SECURE PROJECT ACCESS</small><strong>TBM Ring Planner</strong></div></div>
      <div className="auth-copy"><LockKeyhole size={24}/><div><h1 id="auth-title">เข้าสู่ระบบก่อนใช้งาน</h1><p>ข้อมูลแผน TBM1 / TBM2 สำหรับผู้ใช้งานโครงการ</p></div></div>
      <form onSubmit={login} className="auth-form">
        <label>ชื่อผู้ใช้<input autoFocus autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)} required /></label>
        <label>รหัสผ่าน<span className="auth-password"><input type={visible?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required /><button type="button" aria-label={visible?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
        {message && <div className="auth-error" role="alert">{message}</div>}
        <button className="btn primary auth-submit" disabled={status==='submitting'}>{status==='submitting'?<LoaderCircle className="spin" size={18}/>:<LogIn size={18}/>} {status==='submitting'?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบ'}</button>
      </form>
    </section>
  </main>;
}


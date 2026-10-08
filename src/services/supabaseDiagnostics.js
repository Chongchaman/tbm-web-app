export function describeSupabaseError(error, projectUrl = '') {
  const message=String(error?.message||error||'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
  if (!/failed to fetch|fetch failed|networkerror|err_name_not_resolved|nxdomain/i.test(message)) return message;
  let host='Supabase';
  try { host=new URL(projectUrl).hostname||host; } catch {/* The saved URL itself may be invalid. */}
  return `ติดต่อ ${host} ไม่ได้ · ตรวจ Project URL และสถานะโครงการใน Supabase Dashboard (Paused/Deleted) หรือเครือข่าย แล้วทดสอบอีกครั้ง`;
}

export function supabaseProjectDashboardUrl(projectUrl) {
  try {
    const host=new URL(projectUrl).hostname;
    const match=host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?`https://supabase.com/dashboard/project/${match[1]}`:'https://supabase.com/dashboard';
  } catch { return 'https://supabase.com/dashboard'; }
}

import { createSessionToken, credentialsMatch, sessionCookie } from '../../server/auth.js';

async function readBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  let raw = '';
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = await readBody(request);
    const credentials = { username: process.env.TBM_APP_USER, password: process.env.TBM_APP_PASSWORD };
    if (!process.env.TBM_AUTH_SECRET) return response.status(503).json({ error: 'ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน' });
    if (!credentialsMatch(username, password, credentials)) {
      return response.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    const token = createSessionToken({ username: credentials.username, secret: process.env.TBM_AUTH_SECRET });
    response.setHeader('Set-Cookie', sessionCookie(token));
    return response.status(200).json({ authenticated: true, user: credentials.username });
  } catch {
    return response.status(400).json({ error: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง' });
  }
}


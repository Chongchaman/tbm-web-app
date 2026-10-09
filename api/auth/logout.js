import { expiredSessionCookie } from '../../server/auth.js';

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  response.setHeader('Set-Cookie', expiredSessionCookie());
  return response.status(200).json({ authenticated: false });
}


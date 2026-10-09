import { readCookie, verifySessionToken } from '../../server/auth.js';

export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const token = readCookie(request.headers.cookie);
  const session = verifySessionToken(token, { secret: process.env.TBM_AUTH_SECRET });
  if (!session) return response.status(401).json({ authenticated: false });
  return response.status(200).json({ authenticated: true, user: session.username });
}


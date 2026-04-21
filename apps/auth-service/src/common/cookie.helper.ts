import { Response } from 'express';

// COOKIE_SECURE should be 'true' only when running behind HTTPS.
// NODE_ENV=production alone is not sufficient — a production server
// running HTTP (e.g. behind a load balancer terminating SSL elsewhere)
// still needs secure=false at the cookie level.
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const SAME_SITE =
  (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: SAME_SITE,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: SAME_SITE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth/refresh', // scoped — not sent on every request
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
}

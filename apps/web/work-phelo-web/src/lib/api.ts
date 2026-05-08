import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Routes that should never trigger a token refresh attempt
const SKIP_REFRESH = ['/auth/refresh', '/auth/admin/login', '/auth/login'];

// Shared in-flight refresh promise — prevents concurrent 401s from each
// triggering their own refresh (which would burn the refresh token on the first
// success and cause all subsequent attempts to fail, logging the user out).
let refreshPromise: Promise<unknown> | null = null;

function isAuthPage(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/platform/login' ||
    /^\/[^/]+\/login$/.test(pathname) ||
    pathname.includes('/accept-invite') ||
    pathname.includes('/reset-password') ||
    pathname.includes('/verify-account') ||
    pathname.includes('/forgot-password')
  );
}

function redirectToLogin() {
  const path = window.location.pathname;
  if (isAuthPage(path)) return;
  const tenantMatch = path.match(/^\/([^/]+)\//);
  const isPlatform =
    !tenantMatch || tenantMatch[1] === 'platform' || tenantMatch[1] === 'dashboard';
  window.location.href = isPlatform ? '/platform/login' : `/${tenantMatch![1]}/login`;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? '';

    const shouldSkip = SKIP_REFRESH.some((path) => url.includes(path));

    if (error.response?.status === 401 && !original._retry && !shouldSkip) {
      original._retry = true;

      // If no refresh is in flight, start one; otherwise reuse the existing promise.
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh').finally(() => {
          refreshPromise = null;
        });
      }

      try {
        await refreshPromise;
        return api(original);
      } catch {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  },
);

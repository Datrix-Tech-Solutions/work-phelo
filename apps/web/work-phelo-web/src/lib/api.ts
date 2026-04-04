import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Routes that should never trigger a token refresh attempt
const SKIP_REFRESH = ['/auth/refresh', '/auth/me', '/auth/admin/login', '/auth/login'];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? '';

    const shouldSkip = SKIP_REFRESH.some((path) => url.includes(path));

    if (error.response?.status === 401 && !original._retry && !shouldSkip) {
      original._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(original);
      } catch {
        // Refresh failed — send back to login
        // Derive correct login page from current path
        const path = window.location.pathname;
        const tenantMatch = path.match(/^\/([^/]+)\//);
        const isPlatform =
          !tenantMatch || tenantMatch[1] === 'platform' || tenantMatch[1] === 'dashboard';
        window.location.href = isPlatform ? '/platform/login' : `/${tenantMatch![1]}/login`;
      }
    }
    return Promise.reject(error);
  },
);

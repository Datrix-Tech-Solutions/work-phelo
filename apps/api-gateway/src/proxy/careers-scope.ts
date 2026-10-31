/**
 * What a token issued to the careers site may call. Everything else is refused
 * at the gateway, even for a company admin, so a careers-site session can never
 * reach employee, payroll or other company data.
 */
const CAREERS_SCOPE_ROUTES: { method: string; pattern: RegExp }[] = [
  // Job openings: list, post, view, edit (this is how a draft is published),
  // close, reopen.
  { method: 'GET', pattern: /^\/api\/v1\/hr\/recruitment\/vacancies$/ },
  { method: 'POST', pattern: /^\/api\/v1\/hr\/recruitment\/vacancies$/ },
  { method: 'GET', pattern: /^\/api\/v1\/hr\/recruitment\/vacancies\/[^/]+$/ },
  {
    method: 'PATCH',
    pattern: /^\/api\/v1\/hr\/recruitment\/vacancies\/[^/]+$/,
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/hr\/recruitment\/vacancies\/[^/]+\/(?:close|reopen)$/,
  },
  // Applicants: the list only.
  { method: 'GET', pattern: /^\/api\/v1\/hr\/recruitment\/candidates$/ },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/logout$/ },
];

export function isAllowedForCareersToken(method: string, path: string) {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return CAREERS_SCOPE_ROUTES.some(
    (route) =>
      route.method === method.toUpperCase() && route.pattern.test(normalized),
  );
}

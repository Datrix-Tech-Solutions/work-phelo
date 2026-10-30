import { isAllowedForCareersToken } from './careers-scope';

describe('isAllowedForCareersToken', () => {
  it.each([
    ['GET', '/api/v1/hr/recruitment/vacancies'],
    ['POST', '/api/v1/hr/recruitment/vacancies'],
    ['GET', '/api/v1/hr/recruitment/vacancies/abc-123'],
    ['PATCH', '/api/v1/hr/recruitment/vacancies/abc-123'],
    ['POST', '/api/v1/hr/recruitment/vacancies/abc-123/close'],
    ['POST', '/api/v1/hr/recruitment/vacancies/abc-123/reopen'],
    ['GET', '/api/v1/hr/recruitment/candidates'],
    ['POST', '/api/v1/auth/logout'],
    ['GET', '/api/v1/hr/recruitment/vacancies/'],
  ])('allows %s %s', (method, path) => {
    expect(isAllowedForCareersToken(method, path)).toBe(true);
  });

  it.each([
    // Other recruitment actions the site never performs.
    ['POST', '/api/v1/hr/recruitment/vacancies/abc-123/cutoff'],
    ['PATCH', '/api/v1/hr/recruitment/vacancies/abc-123/extra'],
    ['GET', '/api/v1/hr/recruitment/candidates/abc-123'],
    ['PATCH', '/api/v1/hr/recruitment/candidates/abc-123/stage'],
    ['POST', '/api/v1/hr/recruitment/candidates/abc-123/interviews'],
    ['GET', '/api/v1/hr/recruitment/stages'],
    // Wrong method on an allowed path.
    ['DELETE', '/api/v1/hr/recruitment/vacancies'],
    ['POST', '/api/v1/hr/recruitment/candidates'],
    // Anything outside recruitment.
    ['GET', '/api/v1/hr/employees'],
    ['GET', '/api/v1/hr/payroll/runs'],
    ['GET', '/api/v1/auth/me'],
    ['GET', '/api/v1/auth/users'],
    ['GET', '/api/v1/accounting/accounts'],
    // Look-alike paths.
    ['GET', '/api/v1/hr/recruitment/vacancies/abc/extra/close'],
    ['GET', '/api/v1/hr/recruitment/vacanciesx'],
  ])('refuses %s %s', (method, path) => {
    expect(isAllowedForCareersToken(method, path)).toBe(false);
  });
});

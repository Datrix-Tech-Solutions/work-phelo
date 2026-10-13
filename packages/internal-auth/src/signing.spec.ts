import {
  buildAuthHeaders,
  canonicalBody,
  canonicalJson,
  canonicalQuery,
  computeRequestSignature,
} from './signing';
import { INTERNAL_SERVICE_AUTH_HEADERS } from './constants';

const SECRET = 'a-secure-internal-service-secret-of-at-least-32-characters';

describe('canonicalJson', () => {
  it('sorts keys at every depth and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [{ z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[{"y":2,"z":1}]},"b":1}',
    );
  });

  it('serialises dates the way JSON.stringify sends them', () => {
    const date = new Date('2026-10-04T10:00:00.000Z');
    expect(canonicalJson({ at: date })).toBe('{"at":"2026-10-04T10:00:00.000Z"}');
  });
});

describe('canonicalBody', () => {
  it.each([undefined, null, {}])('treats %p as no body', (body) => {
    expect(canonicalBody(body)).toBe('');
  });

  it('keeps a real body', () => {
    expect(canonicalBody({ amount: 20000 })).toBe('{"amount":20000}');
  });
});

describe('canonicalQuery', () => {
  it('is independent of pair order', () => {
    expect(
      canonicalQuery([
        ['b', '2'],
        ['a', '1'],
      ]),
    ).toBe(
      canonicalQuery([
        ['a', '1'],
        ['b', '2'],
      ]),
    );
    expect(
      canonicalQuery([
        ['b', '2'],
        ['a', '1'],
      ]),
    ).toBe('a=1&b=2');
  });
});

describe('computeRequestSignature', () => {
  const base = {
    serviceName: 'marketing-service',
    timestamp: '1790000000',
    method: 'POST',
    path: '/internal/source-transactions',
    query: [['tenantId', 't1']] as Array<[string, string]>,
    body: { amount: 20000 },
    actingUserId: 'user-1',
  };

  it('is stable for the same input', () => {
    expect(computeRequestSignature(SECRET, base)).toBe(computeRequestSignature(SECRET, base));
  });

  it.each([
    ['tenant', { query: [['tenantId', 't2']] as Array<[string, string]> }],
    ['body', { body: { amount: 1 } }],
    ['acting user', { actingUserId: 'user-2' }],
    ['path', { path: '/internal/other' }],
    ['method', { method: 'PUT' }],
  ])('changes when the %s changes', (_name, change) => {
    expect(computeRequestSignature(SECRET, { ...base, ...change })).not.toBe(
      computeRequestSignature(SECRET, base),
    );
  });
});

describe('buildAuthHeaders', () => {
  const input = {
    secret: SECRET,
    serviceName: 'marketing-service',
    method: 'GET',
    path: '/internal/x',
  };

  it('sends only the legacy headers unless a request signature is asked for', () => {
    const headers = buildAuthHeaders(input);
    expect(headers[INTERNAL_SERVICE_AUTH_HEADERS.requestSignature]).toBeUndefined();
    expect(headers[INTERNAL_SERVICE_AUTH_HEADERS.actingUser]).toBeUndefined();
  });

  it('adds the request signature and the acting user when asked', () => {
    const headers = buildAuthHeaders({
      ...input,
      signRequest: { query: [], body: undefined, actingUserId: 'user-1' },
    });
    expect(headers[INTERNAL_SERVICE_AUTH_HEADERS.requestSignature]).toMatch(/^[a-f\d]{64}$/);
    expect(headers[INTERNAL_SERVICE_AUTH_HEADERS.actingUser]).toBe('user-1');
  });
});

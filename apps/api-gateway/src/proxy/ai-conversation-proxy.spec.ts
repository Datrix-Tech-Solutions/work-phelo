import { Request } from 'express';
import { checkBrowserOrigin } from './ai-conversation-proxy';

describe('AI-specific cookie mutation Origin policy (not CORS authorization)', () => {
  const original = process.env.ALLOWED_ORIGINS;
  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:4000';
  });
  afterAll(() => {
    if (original === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = original;
  });
  function req(
    origin?: unknown,
    method = 'POST',
    cookies: unknown = { access_token: 'fixture' },
  ) {
    return { method, cookies, headers: { origin } } as unknown as Request;
  }
  it.each(['http://localhost:3000', 'http://localhost:4000'])(
    'allows the explicitly configured origin %s',
    (origin) => {
      expect(() => checkBrowserOrigin(req(origin))).not.toThrow();
    },
  );
  it.each([
    undefined,
    'null',
    '*',
    'http://localhost:3000/',
    'https://evil.test',
    'http://localhost:3000.evil.test',
    ['http://localhost:3000'],
    'http://localhost:3000?x=1',
    'http://user@localhost:3000',
  ])('rejects missing/malformed/untrusted Origin %j', (origin) => {
    expect(() => checkBrowserOrigin(req(origin))).toThrow();
  });
  it('rejects wildcard configuration rather than expanding trusted browser origins', () => {
    process.env.ALLOWED_ORIGINS = '*';
    expect(() => checkBrowserOrigin(req('http://localhost:3000'))).toThrow();
  });
  it('does not apply ambient-cookie CSRF rules to Bearer-only requests', () => {
    expect(() => checkBrowserOrigin(req(undefined, 'POST', {}))).not.toThrow();
  });
  it('does not require Origin for a read-only cookie request', () => {
    expect(() => checkBrowserOrigin(req(undefined, 'GET'))).not.toThrow();
  });
});

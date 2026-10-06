import { TermiiSmsProvider } from './termii-sms.provider';

describe('TermiiSmsProvider', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      TERMII_API_KEY: 'termii-key',
      TERMII_SENDER_ID: 'WorkPhelo',
    };
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('uses the configured sender by default', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'ok' }));

    await new TermiiSmsProvider().sendMessage('+233244000001', 'Hello');

    const body = requestBody();
    expect(body.from).toBe('WorkPhelo');
  });

  it('uses the per-message sender ID when provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: 'ok' }));

    await new TermiiSmsProvider().sendMessage('+233244000001', 'Hello', {
      senderId: 'TENANTSMS',
    });

    const body = requestBody();
    expect(body.from).toBe('TENANTSMS');
  });

  function jsonResponse(body: unknown): Response {
    return {
      ok: true,
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response;
  }

  function requestBody(): Record<string, unknown> {
    const [, init] = fetchMock.mock.calls[0] ?? [];
    if (typeof init?.body !== 'string') return {};
    return JSON.parse(init.body) as Record<string, unknown>;
  }
});

import { AgooSmsProvider } from './agoosms-sms.provider';

describe('AgooSmsProvider', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AGOOSMS_API_KEY: 'agoo-key',
      AGOOSMS_BASE_URL: 'https://api.agoosms.test',
      AGOOSMS_SANDBOX: 'true',
    };
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('uses the configured endpoint and API key header', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        status: 'accepted',
        id: 'msg-1',
      }),
    );

    await expect(
      new AgooSmsProvider().sendMessage('0244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: true,
      status: 'SENT',
      provider: 'agoosms',
      providerStatus: 'accepted',
      providerMessageId: 'msg-1',
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.agoosms.test/v1/sms/send');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-API-Key': 'agoo-key',
    });
    expect(requestBody()).toEqual({
      to: '+233244000001',
      message: 'Hello',
    });
  });

  it('supports distinct sandbox and live paths when configured', async () => {
    process.env.AGOOSMS_SANDBOX_PATH = '/sandbox/sms/send';
    process.env.AGOOSMS_LIVE_PATH = '/v1/sms/send';
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await new AgooSmsProvider().sendMessage('+233244000001', 'Hello');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.agoosms.test/sandbox/sms/send',
    );

    jest.clearAllMocks();
    process.env.AGOOSMS_SANDBOX = 'false';
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await new AgooSmsProvider().sendMessage('+233244000001', 'Hello');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.agoosms.test/v1/sms/send',
    );
  });

  it('does not invent an undocumented sender request field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await new AgooSmsProvider().sendMessage('+233244000001', 'Hello', {
      senderId: 'TENANTSMS',
    });

    expect(requestBody()).toEqual({
      to: '+233244000001',
      message: 'Hello',
    });
  });

  it('treats accepted responses as submitted', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { status: 'queued', reference: 987 },
        message: 'queued',
      }),
    );

    await expect(
      new AgooSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: true,
      status: 'SENT',
      providerStatus: 'queued',
      providerMessageId: '987',
      providerDetail: 'queued',
    });
  });

  it('maps provider failures to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'invalid recipient' }, false, 400),
    );

    await expect(
      new AgooSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '400',
      providerDetail: 'invalid recipient',
      error: 'invalid recipient',
    });
  });

  it('maps authentication failures to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'invalid API key' }, false, 401),
    );

    await expect(
      new AgooSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '401',
      providerDetail: 'invalid API key',
    });
  });

  it('maps rate limit failures to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'rate limited' }, false, 429),
    );

    await expect(
      new AgooSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '429',
      providerDetail: 'rate limited',
    });
  });

  it('maps provider 5xx failures to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'provider unavailable' }, false, 503),
    );

    await expect(
      new AgooSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '503',
      providerDetail: 'provider unavailable',
    });
  });

  it('skips invalid Ghana phone numbers without calling the provider', async () => {
    await expect(
      new AgooSmsProvider().sendMessage('020', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'SKIPPED',
      providerStatus: 'INVALID_RECIPIENT',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns failed on timeout or network errors without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('request timeout'));

    await expect(
      new AgooSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      error: 'request timeout',
    });
  });

  function jsonResponse(body: unknown, ok = true, status = 200): Response {
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response;
  }

  function requestBody(): Record<string, unknown> {
    const [, init] = fetchMock.mock.calls[0] ?? [];
    if (typeof init?.body !== 'string') return {};
    return JSON.parse(init.body) as Record<string, unknown>;
  }
});

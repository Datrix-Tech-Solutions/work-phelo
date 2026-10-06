import { SasuSyncSmsProvider } from './sasusync-sms.provider';

describe('SasuSyncSmsProvider', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SASUSYNC_API_KEY: 'sasusync-key',
      SASUSYNC_BASE_URL: 'https://sms.sasusync.test',
      SASUSYNC_SENDER_ID: 'WorkPhelo',
      SASUSYNC_SANDBOX: 'true',
    };
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('uses the sandbox endpoint and API key header by default', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { status: 'queued', job_id: 'sandbox-job' },
      }),
    );

    await expect(
      new SasuSyncSmsProvider().sendMessage('0244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: true,
      status: 'SENT',
      provider: 'sasusync',
      providerStatus: 'queued',
      providerMessageId: 'sandbox-job',
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://sms.sasusync.test/smssandbox/v1/send');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-API-Key': 'sasusync-key',
    });
    expect(requestBody()).toEqual({
      sender: 'WorkPhelo',
      recipients: ['233244000001'],
      message: 'Hello',
    });
  });

  it('uses the live endpoint when sandbox is disabled', async () => {
    process.env.SASUSYNC_SANDBOX = 'false';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { status: 'queued', job_id: 'live-job' },
      }),
    );

    await new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello');

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://sms.sasusync.test/api/v1/send');
  });

  it('uses the per-message sender ID when provided', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { status: 'queued', job_id: 'tenant-job' },
      }),
    );

    await new SasuSyncSmsProvider().sendMessage('233244000001', 'Hello', {
      senderId: 'TENANTSMS',
    });

    expect(requestBody()).toMatchObject({
      sender: 'TENANTSMS',
      recipients: ['233244000001'],
      message: 'Hello',
    });
  });

  it('treats queued responses as accepted', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        queued: true,
        data: { status: 'queued', job_id: 1841 },
        message: 'Your message is queued',
      }),
    );

    await expect(
      new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: true,
      status: 'SENT',
      providerStatus: 'queued',
      providerMessageId: '1841',
      providerDetail: 'Your message is queued',
    });
  });

  it('maps provider validation errors to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          detail: 'sender is required',
        },
        false,
        400,
      ),
    );

    await expect(
      new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '400',
      providerDetail: 'sender is required',
      error: 'sender is required',
    });
  });

  it('maps authentication errors to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Invalid API key' }, false, 401),
    );

    await expect(
      new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '401',
      providerDetail: 'Invalid API key',
    });
  });

  it('maps provider balance errors to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Insufficient SMS credits' }, false, 402),
    );

    await expect(
      new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '402',
      providerDetail: 'Insufficient SMS credits',
    });
  });

  it('maps rate limits to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Too many requests' }, false, 429),
    );

    await expect(
      new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '429',
      providerDetail: 'Too many requests',
    });
  });

  it('maps provider 5xx responses to failed results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Provider unavailable' }, false, 503),
    );

    await expect(
      new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello'),
    ).resolves.toMatchObject({
      success: false,
      status: 'FAILED',
      providerStatus: '503',
      providerDetail: 'Provider unavailable',
    });
  });

  it('skips invalid Ghana phone numbers without calling the provider', async () => {
    await expect(
      new SasuSyncSmsProvider().sendMessage('020', 'Hello'),
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
      new SasuSyncSmsProvider().sendMessage('+233244000001', 'Hello'),
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

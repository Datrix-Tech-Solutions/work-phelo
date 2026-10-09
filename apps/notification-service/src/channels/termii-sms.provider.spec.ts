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

  it('requests sender identity review without mapping it to approved', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Sender ID request submitted' }),
    );

    await expect(
      new TermiiSmsProvider().submitSenderIdentity({
        senderId: 'TENANTSMS',
        purpose: 'Marketing SMS campaign messages',
        tenantDomain: 'example.com',
      }),
    ).resolves.toMatchObject({
      provider: 'termii',
      providerStatus: 'SUBMITTED',
      providerReferenceId: 'TENANTSMS',
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.ng.termii.com/api/sender-id/request');
    expect(requestBody()).toMatchObject({
      api_key: 'termii-key',
      sender_id: 'TENANTSMS',
      usecase: 'Marketing SMS campaign messages',
      company: 'example.com',
    });
  });

  it('refreshes sender status from the sender-id list', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ sender_id: 'TENANTSMS', status: 'unblock' }],
      }),
    );

    await expect(
      new TermiiSmsProvider().getSenderIdentityStatus({
        senderId: 'TENANTSMS',
      }),
    ).resolves.toMatchObject({
      providerStatus: 'APPROVED',
      providerReferenceId: 'TENANTSMS',
      rawProviderStatus: 'unblock',
    });
  });

  it('maps blocked and pending sender statuses explicitly', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ sender_id: 'TENANTSMS', status: 'blocked' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ sender_id: 'TENANTSMS', status: 'pending' }],
        }),
      );

    await expect(
      new TermiiSmsProvider().getSenderIdentityStatus({
        senderId: 'TENANTSMS',
      }),
    ).resolves.toMatchObject({
      providerStatus: 'SUSPENDED',
      rawProviderStatus: 'blocked',
    });

    await expect(
      new TermiiSmsProvider().getSenderIdentityStatus({
        senderId: 'TENANTSMS',
      }),
    ).resolves.toMatchObject({
      providerStatus: 'PENDING',
      rawProviderStatus: 'pending',
    });
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

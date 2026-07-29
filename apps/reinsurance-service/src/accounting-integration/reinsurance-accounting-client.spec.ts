import { createHmac } from 'crypto';
import { ReinsuranceAccountingClient } from './reinsurance-accounting-client';

describe('ReinsuranceAccountingClient', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    process.env = {
      ...originalEnv,
      ACCOUNTING_SERVICE_URL: 'http://accounting-service:4008',
      INTERNAL_SERVICE_AUTH_SECRET: 'x'.repeat(32),
      ACCOUNTING_SERVICE_TIMEOUT_MS: '5000',
    };
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('posts the accounting source event with the HMAC headers Accounting expects', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'source-event-1',
          status: 'RECEIVED',
          idempotencyKey: 'reinsurance:test:1:v1',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );

    const client = new ReinsuranceAccountingClient();
    const result = await client.enqueueSourceEvent({
      tenantId: 'tenant-1',
      sourceModule: 'REINSURANCE',
      sourceEventType: 'TEST_EVENT',
      sourceRecordId: 'record-1',
      idempotencyKey: 'reinsurance:test:1:v1',
      occurredAt: '2026-07-29T10:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { value: 100 } },
    });

    const expectedSignature = createHmac(
      'sha256',
      process.env.INTERNAL_SERVICE_AUTH_SECRET!,
    )
      .update('reinsurance-service:1710000000:POST:/internal/source-events')
      .digest('hex');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(result.id).toBe('source-event-1');
    expect(url).toBe('http://accounting-service:4008/internal/source-events');
    expect(init.method).toBe('POST');
    expect(headers['x-workphelo-service']).toBe('reinsurance-service');
    expect(headers['x-workphelo-timestamp']).toBe('1710000000');
    expect(headers['x-workphelo-signature']).toBe(expectedSignature);
  });

  it('classifies 5xx responses as retryable and 4xx validation as permanent', async () => {
    const client = new ReinsuranceAccountingClient();
    const event = {
      tenantId: 'tenant-1',
      sourceModule: 'REINSURANCE' as const,
      sourceEventType: 'TEST_EVENT',
      sourceRecordId: 'record-1',
      idempotencyKey: 'reinsurance:test:1:v1',
      occurredAt: '2026-07-29T10:00:00.000Z',
      currency: 'GHS',
      payload: { amounts: { value: 100 } },
    };

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Accounting is unavailable' }), {
        status: 503,
      }),
    );
    await expect(client.enqueueSourceEvent(event)).rejects.toMatchObject({
      retryable: true,
      statusCode: 503,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Malformed payload' }), {
        status: 400,
      }),
    );
    await expect(client.enqueueSourceEvent(event)).rejects.toMatchObject({
      retryable: false,
      statusCode: 400,
    });
  });
});

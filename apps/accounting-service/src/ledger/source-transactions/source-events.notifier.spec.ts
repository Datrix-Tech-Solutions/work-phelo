/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { SourceEventsNotifier } from './source-events.notifier';

describe('SourceEventsNotifier', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let notifier: SourceEventsNotifier;

  const event = {
    tenantId: 'tenant-1',
    sourceModule: 'MARKETING',
    transactionId: 'txn-1',
    event: 'POSTED' as const,
  };

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ handled: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.MARKETING_SERVICE_URL = 'http://marketing.local:4006';
    process.env.INTERNAL_SERVICE_AUTH_SECRET =
      'a-secure-internal-service-secret-of-at-least-32-characters';
    notifier = new SourceEventsNotifier();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('tells the module that raised the transaction, signed as accounting-service', async () => {
    await notifier.notify(event);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://marketing.local:4006/internal/accounting-events');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      tenantId: 'tenant-1',
      sourceModule: 'MARKETING',
      transactionId: 'txn-1',
      event: 'POSTED',
    });
    expect(init.headers['x-workphelo-service']).toBe('accounting-service');
    expect(init.headers['x-workphelo-request-signature']).toMatch(
      /^[a-f\d]{64}$/,
    );
  });

  it.each([[null], [undefined], ['ACCOUNTING'], ['HR']])(
    'sends nothing for transactions that did not come from a registered module (%p)',
    async (sourceModule) => {
      await notifier.notify({ ...event, sourceModule });

      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('skips quietly when the module’s service is not configured', async () => {
    delete process.env.MARKETING_SERVICE_URL;

    await expect(notifier.notify(event)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never fails the action it is reporting when delivery fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(notifier.notify(event)).resolves.toBeUndefined();
  });

  it('never fails the action when the module answers with an error', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'nope' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(notifier.notify(event)).resolves.toBeUndefined();
  });
});

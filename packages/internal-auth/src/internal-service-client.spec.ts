import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { INTERNAL_SERVICE_AUTH_HEADERS } from './constants';
import { InternalServiceAuthGuard } from './internal-service-auth.guard';
import { InternalServiceClient, InternalServiceClientError } from './internal-service-client';

const SECRET = 'a-secure-internal-service-secret-of-at-least-32-characters';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('InternalServiceClient', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;

  const client = (baseUrl: string | undefined = 'http://hr.local:4002/') =>
    new InternalServiceClient({
      serviceName: 'marketing-service',
      targetName: 'hr-service',
      baseUrl,
      secret: SECRET,
    });

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.INTERNAL_SERVICE_AUTH_SECRET = SECRET;
    process.env.INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES = 'marketing-service';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('sends requests the guard accepts (round trip)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await client().get('/internal/fleet-assets', {
      query: { tenantId: 't1', status: undefined },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://hr.local:4002/internal/fleet-assets?tenantId=t1');

    const request = {
      headers: init.headers,
      method: 'GET',
      originalUrl: '/internal/fleet-assets?tenantId=t1',
    } as unknown as Request;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    expect(new InternalServiceAuthGuard().canActivate(context)).toBe(true);
    expect(init.headers[INTERNAL_SERVICE_AUTH_HEADERS.service]).toBe('marketing-service');
  });

  it('serialises a JSON body for POST', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'a1' }));

    const result = await client().post<{ id: string }>('/internal/x', {
      body: { name: 'Van' },
    });

    expect(result).toEqual({ id: 'a1' });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(JSON.stringify({ name: 'Van' }));
    expect(init.headers['content-type']).toBe('application/json');
  });

  it.each([
    [500, true],
    [429, true],
    [404, false],
    [400, false],
  ])('classifies status %i as retryable=%s', async (status, retryable) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { message: ['bad', 'x'] }));

    await expect(client().get('/internal/x')).rejects.toMatchObject({
      statusCode: status,
      retryable,
      message: 'bad, x',
    });
  });

  it('treats network failures as retryable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(client().get('/internal/x')).rejects.toMatchObject({
      retryable: true,
    });
  });

  it('fails without retry when misconfigured', async () => {
    await expect(client('').get('/x')).rejects.toBeInstanceOf(InternalServiceClientError);
    await expect(client('not a url').get('/x')).rejects.toMatchObject({
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client('').isConfigured()).toBe(false);
    expect(client().isConfigured()).toBe(true);
  });

  it('signs the body, the query and the acting user, and the guard accepts it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'a1' }));

    await client().post('/internal/source-transactions', {
      query: { tenantId: 't1' },
      body: { amount: 20000, note: undefined },
      actingUserId: 'user-1',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.headers[INTERNAL_SERVICE_AUTH_HEADERS.actingUser]).toBe('user-1');

    const request = {
      headers: init.headers,
      method: 'POST',
      originalUrl: url.replace('http://hr.local:4002', ''),
      // What a body parser would hand the guard after the JSON round trip.
      body: JSON.parse(init.body),
    } as unknown as Request & { internalActingUserId?: string };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(new InternalServiceAuthGuard().canActivate(context)).toBe(true);
    expect(request.internalActingUserId).toBe('user-1');
  });
});

import { HttpException } from '@nestjs/common';
import { InferenceProviderError } from '../inference/provider-error';
import { normalizeError } from './http-exception.filter';

describe('Safe HTTP error normalization', () => {
  it('handles hostile exception properties without leaking or throwing', () => {
    const error = {
      get type(): string {
        throw new Error('private-error-property');
      },
    };
    expect(normalizeError(error)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Service unavailable',
    });
  });

  it.each([
    [400, 'INVALID_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [413, 'REQUEST_TOO_LARGE'],
    [429, 'RATE_LIMITED'],
    [418, 'REQUEST_REJECTED'],
    [503, 'SERVICE_UNAVAILABLE'],
    [504, 'GATEWAY_TIMEOUT'],
  ])('preserves HTTP %s without exposing its payload', (status, code) => {
    const safe = normalizeError(
      new HttpException(
        { message: 'private-prompt', stack: '/private/path', token: 'secret' },
        Number(status),
      ),
    );
    expect(safe).toMatchObject({ statusCode: status, code });
    expect(JSON.stringify(safe)).not.toMatch(/private-prompt|private\/path|secret/);
  });

  it.each([
    ['CANCELLED', 408],
    ['DEADLINE_EXCEEDED', 504],
    ['UNAVAILABLE', 503],
    ['INVALID_RESPONSE', 502],
  ] as const)('maps provider %s safely', (code, statusCode) => {
    const error = new InferenceProviderError(code);
    error.message = 'private-provider-message';
    expect(normalizeError(error)).toMatchObject({ statusCode, code });
    expect(JSON.stringify(normalizeError(error))).not.toMatch(/private|stack|submissionState/);
  });

  it.each([new Error('private'), 'private', { message: 'private', status: 200 }, null, undefined])(
    'normalizes unknown exceptions',
    (error) => {
      expect(normalizeError(error)).toEqual({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Service unavailable',
      });
    },
  );

  it.each([
    [{ type: 'entity.too.large', body: 'private' }, 413],
    [{ type: 'entity.parse.failed', body: 'private' }, 400],
  ] as const)('preserves parser failures', (error, statusCode) => {
    expect(normalizeError(error).statusCode).toBe(statusCode);
    expect(JSON.stringify(normalizeError(error))).not.toContain('private');
  });
});

import { InferenceProviderError, ProviderErrorCode } from './provider-error';

describe('InferenceProviderError', () => {
  it.each(['CANCELLED', 'DEADLINE_EXCEEDED', 'UNAVAILABLE', 'INVALID_RESPONSE'] as const)(
    'serializes safe metadata for %s without a stack',
    (code: ProviderErrorCode) => {
      const error = new InferenceProviderError(code);
      expect(JSON.parse(JSON.stringify(error))).toEqual({
        code,
        message: error.message,
        retry: error.retry,
        submissionState: 'UNKNOWN',
      });
      expect(JSON.stringify(error)).not.toMatch(/stack|cause|credentials|prompt/);
    },
  );

  it.each(['UNAVAILABLE', 'DEADLINE_EXCEEDED'] as const)(
    'does not recommend replaying an ambiguous %s submission',
    (code) => {
      expect(new InferenceProviderError(code).retry).toBe('AFTER_RECONCILIATION');
      expect(new InferenceProviderError(code, 'NOT_SUBMITTED').retry).toBe('AFTER_BACKOFF');
    },
  );

  it.each(['CANCELLED', 'INVALID_RESPONSE'] as const)('never automatically retries %s', (code) => {
    expect(new InferenceProviderError(code, 'NOT_SUBMITTED').retry).toBe('NEVER');
  });
});

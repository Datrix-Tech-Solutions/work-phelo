export type ProviderErrorCode =
  | 'CANCELLED'
  | 'DEADLINE_EXCEEDED'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE';
export type SubmissionState = 'NOT_SUBMITTED' | 'UNKNOWN';
export type RetryClassification = 'NEVER' | 'AFTER_BACKOFF' | 'AFTER_RECONCILIATION';

const messages: Record<ProviderErrorCode, string> = {
  CANCELLED: 'Inference request cancelled',
  DEADLINE_EXCEEDED: 'Inference deadline exceeded',
  UNAVAILABLE: 'Inference provider unavailable',
  INVALID_RESPONSE: 'Inference provider returned an invalid response',
};

export class InferenceProviderError extends Error {
  readonly retry: RetryClassification;

  constructor(
    readonly code: ProviderErrorCode,
    readonly submissionState: SubmissionState = 'UNKNOWN',
  ) {
    super(messages[code]);
    this.name = 'InferenceProviderError';
    this.retry =
      code === 'CANCELLED' || code === 'INVALID_RESPONSE'
        ? 'NEVER'
        : submissionState === 'NOT_SUBMITTED'
          ? 'AFTER_BACKOFF'
          : 'AFTER_RECONCILIATION';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retry: this.retry,
      submissionState: this.submissionState,
    };
  }
}

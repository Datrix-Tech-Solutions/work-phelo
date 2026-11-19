export type MessageEncryptionErrorCode =
  | 'ENCRYPTION_UNAVAILABLE'
  | 'INVALID_CONTEXT'
  | 'INVALID_PLAINTEXT'
  | 'INVALID_ENVELOPE'
  | 'KEY_UNAVAILABLE'
  | 'AUTHENTICATION_FAILED'
  | 'KEY_NOT_RETIRABLE';

export class MessageEncryptionError extends Error {
  constructor(readonly code: MessageEncryptionErrorCode) {
    super('AI message encryption operation failed');
    this.name = 'MessageEncryptionError';
  }
}

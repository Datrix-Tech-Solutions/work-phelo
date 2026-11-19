import { HttpException } from '@nestjs/common';

export class ConversationOperationError extends HttpException {
  constructor(status: 400 | 404 | 409 | 503 | 504) {
    super(
      {
        400: 'Invalid conversation operation',
        404: 'Conversation not found',
        409: 'Idempotency key conflict',
        503: 'Conversation operation unavailable',
        504: 'Conversation deadline exceeded',
      }[status],
      status,
    );
  }
}

import { HttpException } from '@nestjs/common';

export class ResourceError extends HttpException {
  constructor(
    readonly resourceCode:
      | 'AI_STORAGE_QUOTA_EXCEEDED'
      | 'AI_EXECUTION_LIMITED'
      | 'AI_METADATA_CAPACITY',
  ) {
    super(
      'AI resource capacity unavailable',
      resourceCode === 'AI_STORAGE_QUOTA_EXCEEDED'
        ? 409
        : resourceCode === 'AI_EXECUTION_LIMITED'
          ? 429
          : 503,
    );
  }
}

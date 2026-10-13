import { BadGatewayException, HttpException, Logger } from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';

/** Coarse, secret-free hint so a failure can be diagnosed without server logs. */
function failureReason(error: InternalServiceClientError) {
  const status = error.statusCode;
  if (status === 401 || status === 403) {
    return 'HR_SERVICE_REJECTED_CREDENTIALS';
  }
  if (status !== undefined) return `HR_SERVICE_ERROR_${status}`;
  // No HTTP status: either we never sent the request (config) or it never arrived.
  return error.retryable
    ? 'HR_SERVICE_UNREACHABLE'
    : 'HR_SERVICE_NOT_CONFIGURED';
}

/**
 * Runs a call to hr-service. HR validation errors (4xx) pass through so users
 * see why; outages and service-auth problems become a 502 with a reason code.
 */
export async function callHr<T>(
  logger: Logger,
  action: () => Promise<T>,
  unavailableMessage = 'This is temporarily unavailable. Please try again.',
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof InternalServiceClientError)) throw error;
    const status = error.statusCode;
    const passThrough =
      status !== undefined &&
      status >= 400 &&
      status < 500 &&
      ![401, 403, 408, 429].includes(status);
    if (passThrough) throw new HttpException(error.message, status);

    logger.error(`hr-service call failed: ${error.message}`);
    throw new BadGatewayException({
      statusCode: 502,
      error: 'Bad Gateway',
      message: unavailableMessage,
      reason: failureReason(error),
    });
  }
}

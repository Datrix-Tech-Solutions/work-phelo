import { of } from 'rxjs';
import { EventPatterns, GetUserStatusesCommand } from '@work-phelo/types';
import {
  EmployeeAccessProof,
  verifyAccessRpc,
} from '@work-phelo/internal-auth';
import { RabbitMQPublisher } from './rabbitmq.publisher';

describe('Signed status lookup batching compatibility', () => {
  it('preserves bulk notification/recovery inputs while sending at most 100 IDs per signed RPC', async () => {
    const previous = process.env.INTERNAL_SERVICE_AUTH_SECRET;
    process.env.INTERNAL_SERVICE_AUTH_SECRET =
      'test-only-hr-status-batching-secret-123456789';
    try {
      const send = jest.fn(
        (
          pattern: string,
          envelope: {
            payload: GetUserStatusesCommand;
            proof: EmployeeAccessProof;
          },
        ) => {
          expect(pattern).toBe(EventPatterns.AUTH_GET_USER_STATUSES);
          const input = verifyAccessRpc('hr-service', pattern, envelope);
          expect(input.userIds.length).toBeLessThanOrEqual(100);
          expect(input.tenantId).toBe('tenant');
          return of(
            input.userIds.map((userId) => ({ userId, status: 'ACTIVE' })),
          );
        },
      );
      const publisher = new RabbitMQPublisher({} as never, { send } as never);
      const ids = Array.from({ length: 501 }, (_, i) => `user-${i}`);
      const result = await publisher.authGetUserStatuses({
        tenantId: 'tenant',
        userIds: ids,
      });
      expect(result.map((row) => row.userId)).toEqual(ids);
      expect(send).toHaveBeenCalledTimes(6);
    } finally {
      if (previous === undefined)
        delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
      else process.env.INTERNAL_SERVICE_AUTH_SECRET = previous;
    }
  });
});

import { UsersHandler } from './users.handler';
import { RmqContext } from '@nestjs/microservices';
import { EventPatterns } from '@work-phelo/types';
import { signAccessRpc } from '@work-phelo/internal-auth';

type HandlerWithPrivateFormatters = {
  formatError(error: unknown): string;
  formatStack(error: unknown): string | undefined;
};

describe('UsersHandler RPC diagnostics', () => {
  function makeHandler() {
    return new UsersHandler(
      {} as never,
    ) as unknown as HandlerWithPrivateFormatters;
  }

  it('includes useful Prisma error details even when the message is empty', () => {
    const handler = makeHandler();
    const error = Object.assign(new Error(''), {
      code: 'P2003',
      meta: {
        modelName: 'UserPermissionSet',
        field_name: 'UserPermissionSet_userId_fkey',
      },
    });

    expect(handler.formatError(error)).toContain('type=Error');
    expect(handler.formatError(error)).toContain('message=<empty>');
    expect(handler.formatError(error)).toContain('code=P2003');
    expect(handler.formatError(error)).toContain(
      'UserPermissionSet_userId_fkey',
    );
  });

  it('formats stack traces onto one log-safe line', () => {
    const handler = makeHandler();
    const error = new Error('failure');

    const stack = handler.formatStack(error);

    expect(stack).toContain('Error: failure');
    expect(stack).not.toContain('\n');
  });
});

describe('Retired uncorrelated employee provisioning', () => {
  const data = {
    employeeId: 'employee-1',
    tenantId: 'tenant-1',
    email: 'test@example.test',
    firstName: 'Test',
    lastName: 'Employee',
    _meta: {
      messageId: 'test-message',
      correlationId: 'test-correlation',
      timestamp: '2026-11-12T00:00:00Z',
    },
  };
  const context = {
    getChannelRef: () => ({ ack: jest.fn(), nack: jest.fn() }),
    getMessage: () => ({}),
  } as unknown as RmqContext;

  it('rejects legacy provisioning RPC without creating or inviting an account', async () => {
    const provisionEmployeeInvite = jest.fn();
    const handler = new UsersHandler({ provisionEmployeeInvite } as never);
    await expect(
      handler.handleProvisionEmployeeInvite(data, context),
    ).rejects.toBeDefined();
    expect(provisionEmployeeInvite).not.toHaveBeenCalled();
  });

  it('does not let the legacy invite event bypass durable authorization/linking', async () => {
    const invite = jest.fn();
    const handler = new UsersHandler({ invite } as never);
    await handler.handleInviteEmployee(data, context);
    expect(invite).not.toHaveBeenCalled();
  });
});

describe('Employee offboarding RPC boundary', () => {
  const context = {
    getChannelRef: () => ({ ack: jest.fn(), nack: jest.fn() }),
    getMessage: () => ({}),
  } as unknown as RmqContext;
  it('rejects unsigned deactivation without changing the account', async () => {
    const deactivateEmployeeAccess = jest.fn();
    const handler = new UsersHandler({ deactivateEmployeeAccess } as never);
    await expect(
      handler.handleDeactivateEmployeeAccess(
        { tenantId: 'tenant', userId: 'user' } as never,
        context,
      ),
    ).rejects.toBeDefined();
    expect(deactivateEmployeeAccess).not.toHaveBeenCalled();
  });
  it('forwards only verified tenant/user references to the offboarding policy', async () => {
    const previous = process.env.INTERNAL_SERVICE_AUTH_SECRET;
    process.env.INTERNAL_SERVICE_AUTH_SECRET =
      'unit-test-internal-offboarding-secret-123456789';
    try {
      const deactivateEmployeeAccess = jest.fn().mockResolvedValue(undefined);
      const handler = new UsersHandler({ deactivateEmployeeAccess } as never);
      await expect(
        handler.handleDeactivateEmployeeAccess(
          signAccessRpc(
            'hr-service',
            EventPatterns.AUTH_DEACTIVATE_EMPLOYEE_ACCESS,
            { tenantId: 'tenant', userId: 'user', reason: 'OFFBOARDED' },
          ),
          context,
        ),
      ).resolves.toEqual({ deactivated: true });
      expect(deactivateEmployeeAccess).toHaveBeenCalledWith('tenant', 'user');
    } finally {
      if (previous === undefined)
        delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
      else process.env.INTERNAL_SERVICE_AUTH_SECRET = previous;
    }
  });
});

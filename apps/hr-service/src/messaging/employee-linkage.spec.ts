import { EventsHandler } from './events.handler';
import { RmqContext, RpcException } from '@nestjs/microservices';
import { EmployeeAccessLinkHandler } from '../employees/employee-access.controller';

describe('Employee access verification acknowledgments', () => {
  it.each(['verify', 'offboarded'] as const)(
    '%s acknowledges successful and failed RPCs',
    async (method) => {
      const ack = jest.fn();
      const verify = jest.fn().mockResolvedValue({ linked: true });
      const handler = new EmployeeAccessLinkHandler({
        verifyLink: verify,
        verifyOffboarded: verify,
      } as never);
      const context = {
        getChannelRef: () => ({ ack }),
        getMessage: () => ({}),
      } as never;
      await handler[method]({} as never, context);
      expect(ack).toHaveBeenCalledTimes(1);
      verify.mockRejectedValueOnce(new Error('database unavailable'));
      await expect(
        handler[method]({} as never, context),
      ).rejects.toBeInstanceOf(RpcException);
      expect(ack).toHaveBeenCalledTimes(2);
    },
  );
});

describe('Legacy invite acceptance linkage', () => {
  const _meta = {
    messageId: 'test-message',
    correlationId: 'test-correlation',
    timestamp: '2026-11-12T00:00:00Z',
  };
  const employee = { findFirst: jest.fn(), update: jest.fn() };
  const handler = new EventsHandler({} as never, { employee } as never);
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => ({}),
  } as unknown as RmqContext;
  beforeEach(() => jest.resetAllMocks());

  it('preserves an established invited employee account without rewriting its link', async () => {
    employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    await expect(
      handler.handleLinkEmployeeIdentity(
        {
          tenantId: 'tenant-1',
          email: 'login@example.com',
          userId: 'user-1',
          _meta,
        },
        context,
      ),
    ).resolves.toEqual({ linked: true, employeeId: 'employee-1' });
    expect(employee.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', userId: 'user-1' },
      select: { id: true },
    });
    expect(employee.update).not.toHaveBeenCalled();
  });

  it('does not link an unlinked or different-tenant employee by matching email', async () => {
    employee.findFirst.mockResolvedValue(null);
    await expect(
      handler.handleLinkEmployeeIdentity(
        {
          tenantId: 'other-tenant',
          email: 'matching@example.com',
          userId: 'user-1',
          _meta,
        },
        context,
      ),
    ).rejects.toBeInstanceOf(RpcException);
    expect(employee.update).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});

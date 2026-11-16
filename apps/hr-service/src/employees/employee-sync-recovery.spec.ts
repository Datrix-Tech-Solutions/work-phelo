import { EmployeeSyncRecoveryCronService } from './employee-sync-recovery.cron';

describe('Offboarding retry fairness', () => {
  it('advances past inactive records and wraps without scanning an unbounded population', async () => {
    const first = {
      id: 'employee-a',
      userId: 'user-a',
      tenantId: 'tenant',
      email: null,
      offboardReason: 'OFFBOARDED',
      updatedAt: new Date(1),
    };
    const second = {
      ...first,
      id: 'employee-b',
      userId: 'user-b',
      updatedAt: new Date(2),
    };
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([second])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([first]);
    const statuses = jest.fn(({ userIds }: { userIds: string[] }) =>
      Promise.resolve(
        userIds.map((userId) => ({
          userId,
          status: userId === 'user-b' ? 'ACTIVE' : 'INACTIVE',
        })),
      ),
    );
    const deactivate = jest.fn().mockResolvedValue({ deactivated: true });
    const service = new EmployeeSyncRecoveryCronService(
      { employee: { findMany } } as never,
      {} as never,
      {
        authGetUserStatuses: statuses,
        authDeactivateEmployeeAccess: deactivate,
      } as never,
    );
    await service.reconcileOffboardedAuthAccess();
    await service.reconcileOffboardedAuthAccess();
    await service.reconcileOffboardedAuthAccess();
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 100,
        where: expect.objectContaining({
          OR: [
            { updatedAt: { gt: first.updatedAt } },
            { updatedAt: first.updatedAt, id: { gt: first.id } },
          ],
        }),
      }),
    );
    expect(findMany).toHaveBeenCalledTimes(4);
    expect(deactivate).toHaveBeenCalledTimes(3);
    expect(deactivate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-b', tenantId: 'tenant' }),
    );
  });
});

import { BadRequestException } from '@nestjs/common';
import { UsersInternalController } from './users-internal.controller';

describe('UsersInternalController', () => {
  const TENANT = '11111111-1111-4111-8111-111111111111';
  const A = '22222222-2222-4222-8222-222222222222';
  const B = '33333333-3333-4333-8333-333333333333';
  const prisma = { user: { findMany: jest.fn() } };
  const controller = new UsersInternalController(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('returns the names of the requested users in the tenant, asking once', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: A, firstName: 'Ada', lastName: 'Lovelace' },
    ]);

    const result = await controller.names(TENANT, ` ${A}, ${B},${A}`);

    expect(result).toEqual([{ id: A, firstName: 'Ada', lastName: 'Lovelace' }]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, id: { in: [A, B] } },
      select: { id: true, firstName: true, lastName: true },
    });
  });

  it('does not query for no ids', async () => {
    await expect(controller.names(TENANT, '')).resolves.toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('refuses anything that is not a list of user ids', async () => {
    await expect(controller.names(TENANT, 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const tooMany = Array.from({ length: 51 }, () => A);
    expect(tooMany.length).toBe(51);
    const distinct = Array.from(
      { length: 51 },
      (_, i) => `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`,
    );
    await expect(
      controller.names(TENANT, distinct.join(',')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

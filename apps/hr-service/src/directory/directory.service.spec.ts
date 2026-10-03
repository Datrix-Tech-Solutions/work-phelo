import { NotFoundException } from '@nestjs/common';
import { DirectoryService } from './directory.service';

const TENANT = '11111111-1111-4111-8111-111111111111';

const ama = {
  id: 'e1',
  firstName: 'Ama',
  lastName: 'Mensah',
  email: 'ama@example.com',
  jobTitle: 'Driver',
  department: { name: 'Operations' },
};
const kofiRow = {
  id: 'e2',
  firstName: 'Kofi',
  lastName: 'Boateng',
  email: 'kofi@example.com',
  jobTitle: null,
  department: null,
};

describe('DirectoryService', () => {
  const prisma = { employee: { findMany: jest.fn(), findFirst: jest.fn() } };
  const service = new DirectoryService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('never returns encrypted personal fields', async () => {
    prisma.employee.findMany.mockResolvedValue([ama]);

    const [person] = await service.list(TENANT);

    expect(Object.keys(person).sort()).toEqual([
      'department',
      'email',
      'employeeId',
      'jobTitle',
      'name',
    ]);
  });

  it('lists only active employees with their department', async () => {
    prisma.employee.findMany.mockResolvedValue([ama, kofiRow]);

    const result = await service.list(TENANT);

    expect(result).toEqual([
      {
        employeeId: 'e1',
        name: 'Ama Mensah',
        department: 'Operations',
        jobTitle: 'Driver',
        email: 'ama@example.com',
      },
      {
        employeeId: 'e2',
        name: 'Kofi Boateng',
        department: null,
        jobTitle: null,
        email: 'kofi@example.com',
      },
    ]);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT,
          employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
        },
      }),
    );
  });

  it('resolves a user to their employee and validates passengers', async () => {
    prisma.employee.findFirst.mockResolvedValue(ama);
    prisma.employee.findMany.mockResolvedValue([kofiRow]);

    const result = await service.resolve(TENANT, {
      userId: 'user-1',
      employeeIds: ['e2', 'e2'],
    });

    expect(result.person).toMatchObject({
      employeeId: 'e1',
      name: 'Ama Mensah',
      department: 'Operations',
    });
    expect(result.people).toHaveLength(1);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT, userId: 'user-1' },
      }),
    );
  });

  it('returns a null person for a user with no employee record', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    const result = await service.resolve(TENANT, { userId: 'admin-1' });

    expect(result).toEqual({ person: null, people: [] });
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('fails when any requested employee is not an active employee', async () => {
    prisma.employee.findMany.mockResolvedValue([ama]);

    await expect(
      service.resolve(TENANT, { employeeIds: ['e1', 'missing'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

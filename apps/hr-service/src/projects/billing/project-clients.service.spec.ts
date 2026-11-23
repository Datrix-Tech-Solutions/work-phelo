import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProjectClientsService,
  clientNameKey,
} from './project-clients.service';

const admin = { id: 'u1', role: 'TENANT_ADMIN' } as unknown as RequestUser;
const staff = {
  id: 'u2',
  role: 'EMPLOYEE',
  permissions: [],
} as unknown as RequestUser;

function setup(existing: Record<string, unknown> | null = null) {
  const prisma = {
    projectClient: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'c1', ...data }),
        ),
    },
  };
  return {
    prisma,
    service: new ProjectClientsService(prisma as unknown as PrismaService),
  };
}

describe('ProjectClientsService', () => {
  it('compares names without regard to case or spacing', () => {
    expect(clientNameKey('  Dell   Computers ')).toBe('dell computers');
  });

  it('creates a client from just a name', async () => {
    const { service, prisma } = setup();
    const result = await service.create('t1', admin, '  Dell   Computers ');
    expect(prisma.projectClient.create).toHaveBeenCalledWith({
      data: {
        tenantId: 't1',
        name: 'Dell Computers',
        nameKey: 'dell computers',
        createdByUserId: 'u1',
      },
    });
    expect(result).toMatchObject({ name: 'Dell Computers', source: 'PROJECT' });
  });

  it('gives back the client that exists instead of adding a second', async () => {
    const { service, prisma } = setup({ id: 'c9', name: 'Dell' });
    const result = await service.create('t1', admin, 'DELL');
    expect(prisma.projectClient.create).not.toHaveBeenCalled();
    expect(result.id).toBe('c9');
  });

  it('is for people who can start projects', async () => {
    const { service } = setup();
    await expect(service.list('t1', staff)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.create('t1', staff, 'X')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

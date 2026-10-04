/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { AccountingMasterDataService } from './accounting-master-data.service';

describe('AccountingMasterDataService.ensureSourceEntity', () => {
  const input = {
    tenantId: 'tenant-1',
    type: 'marketing client',
    externalRef: 'MARKETING:client-1',
    name: '  Dell Computers ',
  };
  const uniqueError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const makePrisma = () => ({
    entityType: { findFirst: jest.fn() },
    subledgerAccount: { findFirst: jest.fn(), create: jest.fn() },
  });

  let prisma: ReturnType<typeof makePrisma>;
  let service: AccountingMasterDataService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.entityType.findFirst.mockResolvedValue({
      id: 'et-1',
      name: 'Marketing Client',
    });
    prisma.subledgerAccount.findFirst.mockResolvedValue(null);
    prisma.subledgerAccount.create.mockImplementation(
      ({ data }: { data: object }) =>
        Promise.resolve({ id: 'entity-1', status: 'ACTIVE', ...data }),
    );
    service = new AccountingMasterDataService(prisma as never);
  });

  it('creates the entity under the entity type, named and referenced by the record', async () => {
    const entity = await service.ensureSourceEntity('user-1', input);

    expect(prisma.subledgerAccount.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        code: expect.stringMatching(/^MAR-[0-9A-F]{12}$/),
        name: 'Dell Computers',
        // Stored under the entity type's own name, whatever case it was asked for in.
        type: 'Marketing Client',
        externalRef: 'MARKETING:client-1',
        createdByUserId: 'user-1',
        updatedByUserId: 'user-1',
      },
    });
    expect(entity.id).toBe('entity-1');
  });

  it('gives the same code for the same record every time', async () => {
    await service.ensureSourceEntity('user-1', input);
    await service.ensureSourceEntity('user-2', input);

    const [first, second] = prisma.subledgerAccount.create.mock.calls.map(
      (call: Array<{ data: { code: string } }>) => call[0].data.code,
    );
    expect(first).toBe(second);
  });

  it('refuses an entity type the tenant has not configured', async () => {
    prisma.entityType.findFirst.mockResolvedValue(null);

    await expect(
      service.ensureSourceEntity('user-1', input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.subledgerAccount.create).not.toHaveBeenCalled();
  });

  it('finds the record’s entity again by its reference alone, so a changed type never makes a second one', async () => {
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'entity-1',
      status: 'ACTIVE',
      type: 'Some Other Type',
      name: 'Dell Computers Ltd',
    });

    const entity = await service.ensureSourceEntity('user-1', input);

    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', externalRef: 'MARKETING:client-1' },
    });
    expect(prisma.subledgerAccount.create).not.toHaveBeenCalled();
    // Once created it belongs to Accounting - the name is not overwritten.
    expect(entity.name).toBe('Dell Computers Ltd');
  });

  it('will not use an entity that has been deactivated', async () => {
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'entity-1',
      status: 'INACTIVE',
    });

    await expect(
      service.ensureSourceEntity('user-1', input),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('copes with another request creating the same entity at the same moment', async () => {
    prisma.subledgerAccount.create.mockRejectedValue(uniqueError());
    prisma.subledgerAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'entity-raced', status: 'ACTIVE' });

    const entity = await service.ensureSourceEntity('user-1', input);

    expect(entity.id).toBe('entity-raced');
  });

  it('needs a reference and a name', async () => {
    await expect(
      service.ensureSourceEntity('user-1', { ...input, externalRef: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.ensureSourceEntity('user-1', { ...input, name: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

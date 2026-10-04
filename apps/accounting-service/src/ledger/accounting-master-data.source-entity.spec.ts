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
    subledgerAccount: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  });

  let prisma: ReturnType<typeof makePrisma>;
  let service: AccountingMasterDataService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.entityType.findFirst.mockResolvedValue({
      id: 'et-1',
      name: 'Marketing Client',
      code: 'MKC',
    });
    prisma.subledgerAccount.findFirst.mockResolvedValue(null);
    prisma.subledgerAccount.findMany.mockResolvedValue([]);
    prisma.subledgerAccount.create.mockImplementation(
      ({ data }: { data: object }) =>
        Promise.resolve({ id: 'entity-1', status: 'ACTIVE', ...data }),
    );
    service = new AccountingMasterDataService(prisma as never);
  });

  const createdCode = (call = 0) =>
    (
      prisma.subledgerAccount.create.mock.calls[call][0] as {
        data: { code: string };
      }
    ).data.code;

  it('creates the entity under the entity type, named and referenced by the record', async () => {
    const entity = await service.ensureSourceEntity('user-1', input);

    expect(prisma.subledgerAccount.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        code: 'MKC-0001',
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

  describe('entity code', () => {
    it('is the type’s prefix and a four-digit number, starting at 1', async () => {
      await service.ensureSourceEntity('user-1', input);

      expect(createdCode()).toBe('MKC-0001');
    });

    it('continues from the highest number already used, however the entities were made', async () => {
      prisma.subledgerAccount.findMany.mockResolvedValue([
        { code: 'MKC-0003' },
        { code: 'MKC-0007' },
        { code: 'mkc-0005' },
      ]);

      await service.ensureSourceEntity('user-1', input);

      expect(createdCode()).toBe('MKC-0008');
    });

    it('looks only at codes with the same prefix', async () => {
      prisma.subledgerAccount.findMany.mockResolvedValue([
        { code: 'MKC-0002' },
        { code: 'MKC-OLD' },
        { code: 'MKC-0010-X' },
      ]);

      await service.ensureSourceEntity('user-1', input);

      expect(prisma.subledgerAccount.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          code: { startsWith: 'MKC-', mode: 'insensitive' },
        },
        select: { code: true },
      });
      expect(createdCode()).toBe('MKC-0003');
    });

    it('grows past four digits rather than overflowing', async () => {
      prisma.subledgerAccount.findMany.mockResolvedValue([
        { code: 'MKC-9999' },
      ]);

      await service.ensureSourceEntity('user-1', input);

      expect(createdCode()).toBe('MKC-10000');
    });

    it('takes a prefix with special characters literally', async () => {
      prisma.entityType.findFirst.mockResolvedValue({
        id: 'et-1',
        name: 'Marketing Client',
        code: 'A.B',
      });
      prisma.subledgerAccount.findMany.mockResolvedValue([
        { code: 'AxB-0004' },
        { code: 'A.B-0002' },
      ]);

      await service.ensureSourceEntity('user-1', input);

      expect(createdCode()).toBe('A.B-0003');
    });

    it('uses the start of the type’s name when it has no prefix of its own', async () => {
      prisma.entityType.findFirst.mockResolvedValue({
        id: 'et-1',
        name: 'Marketing Client',
        code: null,
      });

      await service.ensureSourceEntity('user-1', input);

      expect(createdCode()).toBe('MAR-0001');
    });

    it('takes the next number when a concurrent entity got the same one', async () => {
      prisma.subledgerAccount.create
        .mockRejectedValueOnce(uniqueError())
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ id: 'entity-1', status: 'ACTIVE', ...data }),
        );
      prisma.subledgerAccount.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ code: 'MKC-0001' }]);

      await service.ensureSourceEntity('user-1', input);

      expect(prisma.subledgerAccount.create).toHaveBeenCalledTimes(2);
      expect(createdCode(1)).toBe('MKC-0002');
    });

    it('gives up with a clear message rather than looping forever', async () => {
      prisma.subledgerAccount.create.mockRejectedValue(uniqueError());

      await expect(
        service.ensureSourceEntity('user-1', input),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.subledgerAccount.create).toHaveBeenCalledTimes(5);
    });
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

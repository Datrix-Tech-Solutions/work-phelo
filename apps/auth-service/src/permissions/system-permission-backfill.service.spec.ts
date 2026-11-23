import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SystemPermissionBackfillService } from './system-permission-backfill.service';
import {
  ensurePermissionResources,
  reconcileTenantPermissionState,
} from './system-permission-sets';

jest.mock('./system-permission-sets', () => ({
  ensurePermissionResources: jest
    .fn()
    .mockResolvedValue({ employees: 'resource-1' }),
  reconcileTenantPermissionState: jest.fn().mockResolvedValue(3),
}));

describe('Explicit permission reconciliation', () => {
  const tx = { $queryRawUnsafe: jest.fn() };
  const prisma = { tenant: { findMany: jest.fn() }, $transaction: jest.fn() };
  let service: SystemPermissionBackfillService;
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-a' },
      { id: 'tenant-b' },
    ]);
    tx.$queryRawUnsafe.mockResolvedValue([{ locked: true }]);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    jest.mocked(reconcileTenantPermissionState).mockResolvedValue(3);
    service = new SystemPermissionBackfillService(prisma as never);
  });

  it('does no backfill work during module initialization, regardless of cohort size', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SystemPermissionBackfillService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    await module.init();
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(ensurePermissionResources).not.toHaveBeenCalled();
    expect(reconcileTenantPermissionState).not.toHaveBeenCalled();
    await module.close();
  });
  it('defaults to bounded dry-run with no permission writes', async () => {
    expect(await service.run()).toMatchObject({
      dryRun: true,
      nextCursor: 'tenant-b',
    });
    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, orderBy: { id: 'asc' } }),
    );
    expect(ensurePermissionResources).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('initializes resources only once and scopes each atomic reconciliation to its tenant', async () => {
    expect(await service.run({ execute: true })).toMatchObject({
      completed: 2,
      users: 6,
      busy: false,
      nextCursor: 'tenant-b',
    });
    expect(ensurePermissionResources).toHaveBeenCalledTimes(1);
    expect(reconcileTenantPermissionState).toHaveBeenNthCalledWith(
      1,
      tx,
      'tenant-a',
      { employees: 'resource-1' },
      expect.anything(),
    );
    expect(reconcileTenantPermissionState).toHaveBeenNthCalledWith(
      2,
      tx,
      'tenant-b',
      { employees: 'resource-1' },
      expect.anything(),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
      maxWait: 5000,
    });
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      'tenant-a',
    );
  });
  it('does not skip a concurrently locked tenant or advance the resume cursor', async () => {
    tx.$queryRawUnsafe.mockResolvedValue([{ locked: false }]);
    expect(
      await service.run({ execute: true, afterTenantId: 'before' }),
    ).toMatchObject({ completed: 0, nextCursor: 'before', busy: true });
    expect(reconcileTenantPermissionState).not.toHaveBeenCalled();
  });
  it('retries transaction conflicts without rerunning global catalog writes', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    expect(
      await service.run({ execute: true, tenantId: 'tenant-a' }),
    ).toMatchObject({ busy: false });
    expect(ensurePermissionResources).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
  it('stops on partial failure, retaining the last committed resume cursor', async () => {
    jest
      .mocked(reconcileTenantPermissionState)
      .mockResolvedValueOnce(3)
      .mockRejectedValueOnce(new Error('sensitive-diagnostic-canary'));
    await expect(service.run({ execute: true })).rejects.toThrow(
      'transaction was rolled back',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
  it('resumes with tenant-scoped ordering and does not inspect earlier tenants', async () => {
    await service.run({ afterTenantId: 'tenant-a', limit: 1 });
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      where: { id: { gt: 'tenant-a' } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 1,
    });
  });
  it.each([0, -1, 101, NaN])(
    'rejects invalid bound %s before querying',
    async (limit) => {
      await expect(service.run({ limit })).rejects.toThrow('limit');
      expect(prisma.tenant.findMany).not.toHaveBeenCalled();
    },
  );
  it('rejects ambiguous tenant/cursor requests before any query', async () => {
    await expect(
      service.run({ tenantId: 'a', afterTenantId: 'b' }),
    ).rejects.toThrow('not both');
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });
});

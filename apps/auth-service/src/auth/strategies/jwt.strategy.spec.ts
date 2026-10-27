import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@work-phelo/types';

describe('Auth current user/tenant state', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    userPermissionSet: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const strategy = new JwtStrategy(
    prisma as unknown as PrismaService,
    { getOrThrow: () => 'strategy-test-secret' } as unknown as ConfigService,
  );
  const payload: JwtPayload = {
    sub: 'user-a',
    tenantId: 'tenant-a',
    email: 'old@example.test',
    role: 'TENANT_ADMIN',
    tenantSlug: 'old',
  };
  const current = {
    id: 'user-a',
    tenantId: 'tenant-a',
    status: 'ACTIVE',
    role: 'EMPLOYEE',
    email: 'current@example.test',
    firstName: 'Current',
    tenant: {
      id: 'tenant-a',
      status: 'ACTIVE',
      slug: 'current',
      name: 'Current',
      moduleConfig: { hr: true },
      featureConfig: { hr: { payroll: false } },
    },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(current);
  });

  it.each([
    ['deleted user', null],
    ['disabled user', { ...current, status: 'DISABLED' }],
    ['pending user', { ...current, status: 'PENDING_VERIFICATION' }],
    ['removed tenant linkage', { ...current, tenant: null }],
    ['changed tenant linkage', { ...current, tenantId: 'other-tenant' }],
    [
      'suspended tenant',
      { ...current, tenant: { ...current.tenant, status: 'SUSPENDED' } },
    ],
    [
      'inactive tenant',
      {
        ...current,
        tenant: { ...current.tenant, status: 'PENDING_VERIFICATION' },
      },
    ],
  ])('rejects %s before permission resolution', async (_label, user) => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.userPermission.findMany).not.toHaveBeenCalled();
    expect(prisma.userPermissionSet.findMany).not.toHaveBeenCalled();
  });
  it('returns current DB role, entitlements and revoked permissions, not JWT snapshots', async () => {
    const result = await strategy.validate(payload);
    expect(result).toMatchObject({
      role: 'EMPLOYEE',
      permissions: [],
      featureConfig: { hr: { payroll: false } },
    });
    expect(prisma.userPermissionSet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-a',
          permissionSet: { tenantId: 'tenant-a', isActive: true },
        },
      }),
    );
  });
  it('rejects a missing tenant claim before querying the database', async () => {
    await expect(
      strategy.validate({ ...payload, tenantId: '' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

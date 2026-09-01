/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionAction } from './dto/grant-permission.dto';

const tenantId = 'tenant-1';

const resources = [
  { id: 'res-auth', name: 'permission-sets', module: 'AUTH', isActive: true },
  { id: 'res-hr', name: 'employees', module: 'HR', isActive: true },
  {
    id: 'res-reinsurance',
    name: 'operations.reinsurance.placements',
    module: 'OPERATIONS',
    isActive: true,
  },
  {
    id: 'res-accounting',
    name: 'accounting.accounts',
    module: 'ACCOUNTING',
    isActive: true,
  },
];

function makeService(options?: {
  moduleConfig?: Record<string, boolean>;
  featureConfig?: Record<string, Record<string, boolean>>;
  permissionSetResources?: Array<{
    resourceId: string;
    action: PermissionAction;
    resource: (typeof resources)[number];
  }>;
}) {
  const permissionSetResources = options?.permissionSetResources ?? [];
  const prisma = {
    tenant: {
      findUnique: jest.fn(async () => ({
        id: tenantId,
        moduleConfig: options?.moduleConfig ?? {
          hr: true,
          operations: true,
          accounting: false,
        },
        featureConfig: options?.featureConfig ?? {
          operations: { reinsurance: true },
        },
      })),
    },
    resource: {
      findMany: jest.fn(
        async ({ where }: { where?: { id?: { in: string[] } } }) => {
          if (where?.id?.in) {
            return resources.filter((resource) =>
              where.id?.in.includes(resource.id),
            );
          }
          return resources;
        },
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { id?: string } }) =>
          resources.find((resource) => resource.id === where.id) ?? null,
      ),
    },
    user: {
      findFirst: jest.fn(
        async ({ where }: { where: { id: string; tenantId: string } }) =>
          where.tenantId === tenantId
            ? { id: where.id, tenantId, role: 'EMPLOYEE' }
            : null,
      ),
    },
    userPermission: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }) => ({ id: 'perm-1', ...data })),
    },
    permissionSet: {
      findFirst: jest.fn(async ({ where }) => {
        if ('name' in where) return null;
        return {
          id: 'set-1',
          tenantId,
          isSystem: false,
          resources: permissionSetResources,
        };
      }),
      create: jest.fn(async ({ data }) => ({ id: 'set-1', ...data })),
      update: jest.fn(async ({ data }) => ({
        id: 'set-1',
        resources: data.resources,
      })),
    },
    permissionSetResource: {
      deleteMany: jest.fn(async () => ({
        count: permissionSetResources.length,
      })),
    },
    userPermissionSet: {
      upsert: jest.fn(async ({ create }) => ({
        id: 'assignment-1',
        ...create,
      })),
    },
  };
  const audit = { log: jest.fn(async () => undefined) };
  return {
    service: new PermissionsService(prisma as never, audit as never),
    prisma,
  };
}

describe('PermissionsService tenant entitlement scoping', () => {
  it('returns only resources enabled for the current tenant', async () => {
    const { service } = makeService();

    await expect(service.getAllResources(tenantId)).resolves.toEqual([
      resources[0],
      resources[1],
      resources[2],
    ]);
  });

  it('hides reinsurance resources when the reinsurance feature is disabled', async () => {
    const { service } = makeService({
      featureConfig: { operations: { reinsurance: false } },
    });

    const visible = await service.getAllResources(tenantId);

    expect(visible.map((resource) => resource.name)).toEqual([
      'permission-sets',
      'employees',
    ]);
  });

  it('allows direct grants for enabled reinsurance resources', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.grant('admin-1', tenantId, {
        userId: 'employee-1',
        resourceId: 'res-reinsurance',
        action: PermissionAction.VIEW,
      }),
    ).resolves.toMatchObject({ message: 'Permission granted' });
    expect(prisma.userPermission.create).toHaveBeenCalled();
  });

  it('rejects direct grants for disabled modules', async () => {
    const { service } = makeService();

    await expect(
      service.grant('admin-1', tenantId, {
        userId: 'employee-1',
        resourceId: 'res-accounting',
        action: PermissionAction.VIEW,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects permission set creation with disabled module resources', async () => {
    const { service } = makeService();

    await expect(
      service.createPermissionSet(tenantId, {
        name: 'Accounting Viewer',
        resources: [
          {
            resourceId: 'res-accounting',
            action: PermissionAction.VIEW,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('preserves historical disabled permissions during unrelated set edits', async () => {
    const { service, prisma } = makeService({
      permissionSetResources: [
        {
          resourceId: 'res-accounting',
          action: PermissionAction.VIEW,
          resource: resources[3],
        },
      ],
    });

    await service.updatePermissionSet(tenantId, 'set-1', {
      resources: [{ resourceId: 'res-hr', action: PermissionAction.VIEW }],
    });

    expect(prisma.permissionSet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resources: {
            create: expect.arrayContaining([
              { resourceId: 'res-hr', action: PermissionAction.VIEW },
              { resourceId: 'res-accounting', action: PermissionAction.VIEW },
            ]),
          },
        }),
      }),
    );
  });

  it('rejects adding new disabled permissions during set edits', async () => {
    const { service } = makeService({
      permissionSetResources: [
        {
          resourceId: 'res-accounting',
          action: PermissionAction.VIEW,
          resource: resources[3],
        },
      ],
    });

    await expect(
      service.updatePermissionSet(tenantId, 'set-1', {
        resources: [
          { resourceId: 'res-hr', action: PermissionAction.VIEW },
          { resourceId: 'res-accounting', action: PermissionAction.EDIT },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects reinsurance grants when the operations module is disabled', async () => {
    const { service } = makeService({
      moduleConfig: { hr: true, operations: false, accounting: false },
      featureConfig: { operations: { reinsurance: true } },
    });

    await expect(
      service.grant('admin-1', tenantId, {
        userId: 'employee-1',
        resourceId: 'res-reinsurance',
        action: PermissionAction.VIEW,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects assignment of a set containing disabled resources', async () => {
    const { service } = makeService({
      permissionSetResources: [
        {
          resourceId: 'res-accounting',
          action: PermissionAction.VIEW,
          resource: resources[3],
        },
      ],
    });

    await expect(
      service.assignPermissionSet('admin-1', tenantId, {
        userId: 'employee-1',
        permissionSetId: 'set-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps grant target tenant isolation intact', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.grant('admin-1', tenantId, {
        userId: 'other-tenant-user',
        resourceId: 'res-hr',
        action: PermissionAction.VIEW,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

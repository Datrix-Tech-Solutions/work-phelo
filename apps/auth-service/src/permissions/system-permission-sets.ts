import { PrismaClient, PermissionAction } from '../../prisma/generated/client';
import { RESOURCES } from './resource-definitions';

type LoggerLike = {
  log(message: string): void;
  warn?(message: string): void;
};

type PermissionResourceMap = Record<string, PermissionAction[]>;
type SystemCompanyRoleName = 'Company Admin' | 'Manager' | 'Employee';

type SystemPermissionSetName =
  | 'Company Admin Set'
  | 'Manager Set'
  | 'Employee Set';

type SystemPermissionSetDefinition = {
  name: SystemPermissionSetName;
  roleName: 'Company Admin' | 'Manager' | 'Employee';
  permissions: PermissionResourceMap;
};

type SyncUserSystemPermissionSetParams = {
  tenantId: string;
  userId: string;
  role: string;
  companyRoleName?: string | null;
  grantedBy: string;
  seededSetIds?: Record<SystemPermissionSetName, string>;
};

const MANAGER_SET: PermissionResourceMap = {
  'company-roles': [PermissionAction.VIEW],
  employees: [PermissionAction.VIEW],
  'employee-profile': [PermissionAction.VIEW, PermissionAction.EDIT],
  resignations: [PermissionAction.CREATE, PermissionAction.DELETE],
  departments: [PermissionAction.VIEW],
  branches: [PermissionAction.VIEW],
  leave: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.APPROVE,
  ],
  attendance: [PermissionAction.VIEW, PermissionAction.CREATE],
  'time-corrections': [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.APPROVE,
  ],
  timesheets: [PermissionAction.VIEW, PermissionAction.APPROVE],
  schedules: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
  ],
  payroll: [PermissionAction.VIEW],
  appraisals: [PermissionAction.VIEW, PermissionAction.EDIT],
  documents: [PermissionAction.VIEW],
};

const EMPLOYEE_SET: PermissionResourceMap = {
  'employee-profile': [PermissionAction.VIEW, PermissionAction.EDIT],
  resignations: [PermissionAction.CREATE, PermissionAction.DELETE],
  leave: [PermissionAction.VIEW, PermissionAction.CREATE],
  attendance: [PermissionAction.CREATE],
  'time-corrections': [PermissionAction.CREATE],
  payroll: [PermissionAction.VIEW],
  appraisals: [PermissionAction.VIEW, PermissionAction.EDIT],
};

const COMPANY_ADMIN_SET: PermissionResourceMap = {
  users: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
  'company-roles': [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.ASSIGN,
  ],
  'permission-sets': [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.ASSIGN,
  ],
  employees: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
    PermissionAction.EXPORT,
  ],
  'employee-profile': [PermissionAction.VIEW, PermissionAction.EDIT],
  resignations: [PermissionAction.CREATE, PermissionAction.DELETE],
  'hr-settings': [PermissionAction.VIEW, PermissionAction.EDIT],
  departments: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
  branches: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
  leave: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.APPROVE,
  ],
  attendance: [PermissionAction.VIEW, PermissionAction.CREATE],
  'time-corrections': [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.APPROVE,
  ],
  timesheets: [PermissionAction.VIEW, PermissionAction.APPROVE],
  schedules: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.DELETE,
  ],
  payroll: [
    PermissionAction.VIEW,
    PermissionAction.RUN,
    PermissionAction.APPROVE,
    PermissionAction.EDIT,
  ],
  appraisals: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
    PermissionAction.APPROVE,
  ],
  documents: [
    PermissionAction.VIEW,
    PermissionAction.CREATE,
    PermissionAction.EDIT,
  ],
};

const SYSTEM_PERMISSION_SET_DEFINITIONS: readonly SystemPermissionSetDefinition[] =
  [
    {
      name: 'Company Admin Set',
      roleName: 'Company Admin',
      permissions: COMPANY_ADMIN_SET,
    },
    { name: 'Manager Set', roleName: 'Manager', permissions: MANAGER_SET },
    { name: 'Employee Set', roleName: 'Employee', permissions: EMPLOYEE_SET },
  ] as const;

type AuthPrisma = Pick<
  PrismaClient,
  | 'resource'
  | 'tenant'
  | 'permissionSet'
  | 'permissionSetResource'
  | 'companyRole'
  | 'user'
  | 'userPermissionSet'
>;

function getLogger(logger?: LoggerLike) {
  return {
    log: logger?.log?.bind(logger) ?? (() => undefined),
    warn: logger?.warn?.bind(logger) ?? (() => undefined),
  };
}

export async function ensurePermissionResources(
  prisma: AuthPrisma,
): Promise<Record<string, string>> {
  const resourceIds: Record<string, string> = {};

  for (const resource of RESOURCES) {
    const created = await prisma.resource.upsert({
      where: { name: resource.name },
      update: { module: resource.module, description: resource.description },
      create: {
        name: resource.name,
        module: resource.module,
        description: resource.description,
      },
      select: { id: true, name: true },
    });
    resourceIds[created.name] = created.id;
  }

  return resourceIds;
}

export async function seedSystemPermissionSets(
  prisma: AuthPrisma,
  tenantId: string,
  logger?: LoggerLike,
): Promise<Record<SystemPermissionSetName, string>> {
  const log = getLogger(logger);
  const resources = await ensurePermissionResources(prisma);
  const seeded: Partial<Record<SystemPermissionSetName, string>> = {};

  for (const set of SYSTEM_PERMISSION_SET_DEFINITIONS) {
    const entries: { resourceId: string; action: PermissionAction }[] = [];

    for (const [resourceName, actions] of Object.entries(set.permissions)) {
      const resourceId = resources[resourceName];
      if (!resourceId) {
        throw new Error(
          `Resource "${resourceName}" is not seeded but is required by ${set.name}`,
        );
      }

      for (const action of actions) {
        entries.push({ resourceId, action });
      }
    }

    const existing = await prisma.permissionSet.findUnique({
      where: { tenantId_name: { tenantId, name: set.name } },
      select: { id: true },
    });

    if (existing) {
      await prisma.permissionSet.update({
        where: { id: existing.id },
        data: { isSystem: true, isActive: true },
      });
      await prisma.permissionSetResource.deleteMany({
        where: { permissionSetId: existing.id },
      });
      await prisma.permissionSetResource.createMany({
        data: entries.map((entry) => ({
          permissionSetId: existing.id,
          resourceId: entry.resourceId,
          action: entry.action,
        })),
        skipDuplicates: true,
      });
      seeded[set.name] = existing.id;
      continue;
    }

    const created = await prisma.permissionSet.create({
      data: {
        tenantId,
        name: set.name,
        isSystem: true,
        resources: {
          create: entries.map((entry) => ({
            resourceId: entry.resourceId,
            action: entry.action,
          })),
        },
      },
      select: { id: true },
    });
    seeded[set.name] = created.id;
  }

  log.log(
    `Ensured system permission sets for tenant ${tenantId}: ${Object.keys(seeded).join(', ')}`,
  );

  return seeded as Record<SystemPermissionSetName, string>;
}

export async function ensureDefaultCompanyRoles(
  prisma: AuthPrisma,
  tenantId: string,
): Promise<Record<SystemCompanyRoleName, string>> {
  const roles = ['Company Admin', 'Manager', 'Employee'] as const;
  const seeded: Partial<Record<SystemCompanyRoleName, string>> = {};

  for (const roleName of roles) {
    const role = await prisma.companyRole.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      update: { isSystem: true, isActive: true },
      create: { tenantId, name: roleName, isSystem: true, isActive: true },
      select: { id: true, name: true },
    });
    seeded[role.name as SystemCompanyRoleName] = role.id;
  }

  return seeded as Record<SystemCompanyRoleName, string>;
}

export function resolveSystemPermissionSetName(
  role: string,
  companyRoleName?: string | null,
): SystemPermissionSetName | null {
  if (role === 'SUPER_ADMIN') return null;
  if (role === 'TENANT_ADMIN') return 'Company Admin Set';

  if (companyRoleName === 'Company Admin') return 'Company Admin Set';
  if (companyRoleName === 'Manager') return 'Manager Set';

  return 'Employee Set';
}

function permissionSetNameToCompanyRoleName(
  setName?: string | null,
): SystemCompanyRoleName | null {
  if (setName === 'Company Admin Set') return 'Company Admin';
  if (setName === 'Manager Set') return 'Manager';
  if (setName === 'Employee Set') return 'Employee';
  return null;
}

function resolveSystemCompanyRoleName(
  role: string,
  companyRoleName?: string | null,
  assignedSystemSetName?: string | null,
): SystemCompanyRoleName | null {
  if (role === 'SUPER_ADMIN') return null;
  if (role === 'TENANT_ADMIN') return 'Company Admin';

  if (companyRoleName === 'Company Admin') return 'Company Admin';
  if (companyRoleName === 'Manager') return 'Manager';
  if (companyRoleName === 'Employee') return 'Employee';

  const derivedFromSet = permissionSetNameToCompanyRoleName(
    assignedSystemSetName,
  );
  if (derivedFromSet) return derivedFromSet;

  return 'Employee';
}

export async function syncUserSystemCompanyRole(
  prisma: AuthPrisma,
  params: {
    tenantId: string;
    userId: string;
    role: string;
    companyRoleName?: string | null;
    assignedSystemSetName?: string | null;
  },
): Promise<SystemCompanyRoleName | null> {
  const targetRoleName = resolveSystemCompanyRoleName(
    params.role,
    params.companyRoleName,
    params.assignedSystemSetName,
  );

  if (!targetRoleName) return null;

  const roleIds = await ensureDefaultCompanyRoles(prisma, params.tenantId);
  await prisma.user.update({
    where: { id: params.userId },
    data: { companyRoleId: roleIds[targetRoleName] },
  });

  return targetRoleName;
}

export async function syncUserSystemPermissionSet(
  prisma: AuthPrisma,
  params: SyncUserSystemPermissionSetParams,
  logger?: LoggerLike,
): Promise<SystemPermissionSetName | null> {
  const log = getLogger(logger);
  const targetSetName = resolveSystemPermissionSetName(
    params.role,
    params.companyRoleName,
  );

  if (!targetSetName) return null;

  const seededSetIds =
    params.seededSetIds ??
    (await seedSystemPermissionSets(prisma, params.tenantId, logger));
  const targetSetId = seededSetIds[targetSetName];

  await prisma.userPermissionSet.deleteMany({
    where: {
      userId: params.userId,
      permissionSetId: {
        in: Object.values(seededSetIds).filter((id) => id !== targetSetId),
      },
    },
  });

  await prisma.userPermissionSet.upsert({
    where: {
      userId_permissionSetId: {
        userId: params.userId,
        permissionSetId: targetSetId,
      },
    },
    update: { grantedBy: params.grantedBy, grantedAt: new Date() },
    create: {
      userId: params.userId,
      permissionSetId: targetSetId,
      grantedBy: params.grantedBy,
    },
  });

  log.log(
    `Synced ${targetSetName} for user ${params.userId} in tenant ${params.tenantId}`,
  );

  return targetSetName;
}

export async function backfillSystemPermissionState(
  prisma: AuthPrisma,
  logger?: LoggerLike,
) {
  const log = getLogger(logger);
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let usersProcessed = 0;

  for (const tenant of tenants) {
    await ensureDefaultCompanyRoles(prisma, tenant.id);
    const seededSetIds = await seedSystemPermissionSets(
      prisma,
      tenant.id,
      logger,
    );
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        role: true,
        companyRoleId: true,
        companyRole: { select: { name: true } },
        permissionSets: {
          where: { permissionSet: { isSystem: true } },
          select: { permissionSet: { select: { name: true } } },
          take: 1,
        },
      },
    });

    for (const user of users) {
      await syncUserSystemPermissionSet(
        prisma,
        {
          tenantId: tenant.id,
          userId: user.id,
          role: user.role,
          companyRoleName: user.companyRole?.name ?? null,
          grantedBy: 'system-backfill',
          seededSetIds,
        },
        logger,
      );

      await syncUserSystemCompanyRole(prisma, {
        tenantId: tenant.id,
        userId: user.id,
        role: user.role,
        companyRoleName: user.companyRole?.name ?? null,
        assignedSystemSetName:
          user.permissionSets[0]?.permissionSet.name ?? null,
      });
      usersProcessed += 1;
    }
  }

  log.log(
    `System permission state backfill complete for ${tenants.length} tenant(s) and ${usersProcessed} user(s)`,
  );
}

import { PrismaClient } from '../prisma/generated/client';
import * as bcrypt from 'bcrypt';
import { seedResources } from './seed-resources';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

// Default permission sets per tenant
// resource name → actions
const MANAGER_SET: Record<string, string[]> = {
  employees: ['VIEW'],
  departments: ['VIEW'],
  leave: ['VIEW', 'APPROVE'],
  attendance: ['VIEW'],
  timesheets: ['VIEW', 'APPROVE'],
  'time-corrections': ['VIEW', 'APPROVE'],
  schedules: ['VIEW', 'CREATE', 'EDIT'],
  appraisals: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
  documents: ['VIEW'],
};

const EMPLOYEE_SET: Record<string, string[]> = {
  employees: ['VIEW'],
  leave: ['VIEW', 'CREATE'],
  attendance: ['VIEW'],
  'time-corrections': ['CREATE'],
  appraisals: ['VIEW'],
  payroll: ['VIEW'],
};

const COMPANY_ADMIN_SET: Record<string, string[]> = {
  users: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  employees: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'],
  departments: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  leave: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT'],
  attendance: ['VIEW', 'EXPORT'],
  timesheets: ['VIEW', 'APPROVE'],
  'time-corrections': ['VIEW', 'APPROVE'],
  schedules: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  payroll: ['VIEW', 'CREATE', 'RUN', 'APPROVE', 'EXPORT'],
  appraisals: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
  documents: ['VIEW', 'CREATE', 'DELETE'],
  allowances: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  'company-roles': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  'permission-sets': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  'audit-logs': ['VIEW', 'EXPORT'],
  'payroll-reports': ['VIEW', 'EXPORT'],
};

async function seedTenantPermissionSets(
  tenantId: string,
  resources: Record<string, string>,
) {
  const sets = [
    { name: 'Company Admin Set', perms: COMPANY_ADMIN_SET, isSystem: true },
    { name: 'Manager Set', perms: MANAGER_SET, isSystem: true },
    { name: 'Employee Set', perms: EMPLOYEE_SET, isSystem: true },
  ];

  const createdSets: Record<string, string> = {};

  for (const set of sets) {
    const existing = await prisma.permissionSet.findUnique({
      where: { tenantId_name: { tenantId, name: set.name } },
    });

    if (existing) {
      createdSets[set.name] = existing.id;
      continue;
    }

    const permSetResources: { resourceId: string; action: any }[] = [];
    for (const [resourceName, actions] of Object.entries(set.perms)) {
      const resourceId = resources[resourceName];
      if (!resourceId) continue;
      for (const action of actions) {
        permSetResources.push({ resourceId, action });
      }
    }

    const created = await prisma.permissionSet.create({
      data: {
        tenantId,
        name: set.name,
        isSystem: set.isSystem,
        resources: { create: permSetResources },
      },
    });
    createdSets[set.name] = created.id;
  }

  return createdSets;
}

async function main() {
  console.log('🌱 Starting seed...\n');

  // ── Seed platform resources first ─────────────────────────────────────────
  console.log('Seeding platform resources...');
  const resources = await seedResources();

  // ── 1. DATRIX INTERNAL (SuperAdmin) ───────────────────────────────────────
  console.log('\nCreating Datrix internal tenant...');
  const datrixTenant = await prisma.tenant.upsert({
    where: { slug: 'datrix-internal' },
    update: {},
    create: {
      name: 'Datrix Tech Solutions',
      slug: 'datrix-internal',
      email: 'internal@datrix.com',
      phone: '+233244000000',
      country: 'GH',
      status: 'ACTIVE',
      industry: 'Technology',
      size: '10-50',
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: datrixTenant.id,
        email: 'superadmin@datrix.com',
      },
    },
    update: {},
    create: {
      tenantId: datrixTenant.id,
      email: 'superadmin@datrix.com',
      password: await hash('SuperAdmin123!'),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('  ✅ superadmin@datrix.com / SuperAdmin123!');

  // ── 2. ACME GHANA ──────────────────────────────────────────────────────────
  console.log('\nCreating Acme Ghana Ltd...');
  const acmeTenant = await prisma.tenant.upsert({
    where: { slug: 'acme-ghana' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Acme Ghana Ltd',
      slug: 'acme-ghana',
      email: 'admin@acmeghana.com',
      phone: '+233302000001',
      country: 'GH',
      status: 'ACTIVE',
      industry: 'Manufacturing',
      size: '100-500',
    },
  });

  // Seed company roles
  const acmeAdminRole = await prisma.companyRole.upsert({
    where: {
      tenantId_name: { tenantId: acmeTenant.id, name: 'Company Admin' },
    },
    update: {},
    create: { tenantId: acmeTenant.id, name: 'Company Admin', isSystem: true },
  });
  const acmeManagerRole = await prisma.companyRole.upsert({
    where: { tenantId_name: { tenantId: acmeTenant.id, name: 'Manager' } },
    update: {},
    create: { tenantId: acmeTenant.id, name: 'Manager', isSystem: true },
  });
  const acmeEmployeeRole = await prisma.companyRole.upsert({
    where: { tenantId_name: { tenantId: acmeTenant.id, name: 'Employee' } },
    update: {},
    create: { tenantId: acmeTenant.id, name: 'Employee', isSystem: true },
  });

  // Seed permission sets
  const acmeSets = await seedTenantPermissionSets(acmeTenant.id, resources);
  console.log(`  ✅ Permission sets: ${Object.keys(acmeSets).join(', ')}`);

  // Users
  const acmeAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: acmeTenant.id, email: 'admin@acmeghana.com' },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'admin@acmeghana.com',
      password: await hash('Admin123!'),
      firstName: 'Abena',
      lastName: 'Mensah',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111001',
    },
  });

  const acmeManager = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'hr.manager@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'hr.manager@acmeghana.com',
      password: await hash('Manager123!'),
      firstName: 'Kwame',
      lastName: 'Asante',
      role: 'EMPLOYEE',
      companyRoleId: acmeManagerRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111002',
    },
  });

  // Assign Manager Set to manager user
  if (acmeSets['Manager Set']) {
    await prisma.userPermissionSet.upsert({
      where: {
        userId_permissionSetId: {
          userId: acmeManager.id,
          permissionSetId: acmeSets['Manager Set'],
        },
      },
      update: {},
      create: {
        userId: acmeManager.id,
        permissionSetId: acmeSets['Manager Set'],
        grantedBy: acmeAdmin.id,
      },
    });
  }

  const acmeEmp1 = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'kofi.boateng@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'kofi.boateng@acmeghana.com',
      password: await hash('Employee123!'),
      firstName: 'Kofi',
      lastName: 'Boateng',
      role: 'EMPLOYEE',
      companyRoleId: acmeEmployeeRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111003',
    },
  });

  // Assign Employee Set to employee
  if (acmeSets['Employee Set']) {
    await prisma.userPermissionSet.upsert({
      where: {
        userId_permissionSetId: {
          userId: acmeEmp1.id,
          permissionSetId: acmeSets['Employee Set'],
        },
      },
      update: {},
      create: {
        userId: acmeEmp1.id,
        permissionSetId: acmeSets['Employee Set'],
        grantedBy: acmeAdmin.id,
      },
    });
  }

  const acmeEmp2 = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'ama.owusu@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'ama.owusu@acmeghana.com',
      password: await hash('Employee123!'),
      firstName: 'Ama',
      lastName: 'Owusu',
      role: 'EMPLOYEE',
      companyRoleId: acmeEmployeeRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111004',
    },
  });

  const acmeAccountant = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'accountant@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'accountant@acmeghana.com',
      password: await hash('Accountant123!'),
      firstName: 'Yaw',
      lastName: 'Darko',
      role: 'EMPLOYEE',
      companyRoleId: acmeManagerRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111005',
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'newuser@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'newuser@acmeghana.com',
      password: await hash('TempPass123!'),
      firstName: 'New',
      lastName: 'User',
      role: 'EMPLOYEE',
      companyRoleId: acmeEmployeeRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      forcePasswordReset: true,
      phone: '+233244111010',
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'mfa.user@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'mfa.user@acmeghana.com',
      password: await hash('MfaUser123!'),
      firstName: 'Mfa',
      lastName: 'User',
      role: 'EMPLOYEE',
      companyRoleId: acmeEmployeeRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111011',
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeTenant.id,
        email: 'invited@acmeghana.com',
      },
    },
    update: {},
    create: {
      tenantId: acmeTenant.id,
      email: 'invited@acmeghana.com',
      firstName: 'Invited',
      lastName: 'Employee',
      role: 'EMPLOYEE',
      companyRoleId: acmeEmployeeRole.id,
      status: 'PENDING_VERIFICATION',
      forcePasswordReset: true,
      inviteToken: 'demo-invite-token-acme-ghana-2026',
      inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  console.log('  ✅ admin@acmeghana.com / Admin123! (TENANT_ADMIN)');
  console.log(
    '  ✅ hr.manager@acmeghana.com / Manager123! → Manager Set assigned',
  );
  console.log(
    '  ✅ kofi.boateng@acmeghana.com / Employee123! → Employee Set assigned',
  );
  console.log('  ✅ ama.owusu@acmeghana.com / Employee123!');
  console.log('  ✅ accountant@acmeghana.com / Accountant123!');
  console.log('  ✅ newuser@acmeghana.com / TempPass123! (force reset)');
  console.log('  ✅ mfa.user@acmeghana.com / MfaUser123!');

  // ── 3. STELLAR TECH ────────────────────────────────────────────────────────
  console.log('\nCreating Stellar Tech Ghana...');
  const stellarTenant = await prisma.tenant.upsert({
    where: { slug: 'stellar-tech' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Stellar Tech Ghana',
      slug: 'stellar-tech',
      email: 'admin@stellartech.com.gh',
      phone: '+233302000002',
      country: 'GH',
      status: 'ACTIVE',
      industry: 'Technology',
      size: '10-50',
    },
  });

  const stellarAdminRole = await prisma.companyRole.upsert({
    where: {
      tenantId_name: { tenantId: stellarTenant.id, name: 'Company Admin' },
    },
    update: {},
    create: {
      tenantId: stellarTenant.id,
      name: 'Company Admin',
      isSystem: true,
    },
  });
  const stellarManagerRole = await prisma.companyRole.upsert({
    where: { tenantId_name: { tenantId: stellarTenant.id, name: 'Manager' } },
    update: {},
    create: { tenantId: stellarTenant.id, name: 'Manager', isSystem: true },
  });
  const stellarEmployeeRole = await prisma.companyRole.upsert({
    where: { tenantId_name: { tenantId: stellarTenant.id, name: 'Employee' } },
    update: {},
    create: { tenantId: stellarTenant.id, name: 'Employee', isSystem: true },
  });

  const stellarSets = await seedTenantPermissionSets(
    stellarTenant.id,
    resources,
  );

  const stellarAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: stellarTenant.id,
        email: 'admin@stellartech.com.gh',
      },
    },
    update: {},
    create: {
      tenantId: stellarTenant.id,
      email: 'admin@stellartech.com.gh',
      password: await hash('Admin123!'),
      firstName: 'Efua',
      lastName: 'Amponsah',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222001',
    },
  });

  const stellarManager = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: stellarTenant.id,
        email: 'manager@stellartech.com.gh',
      },
    },
    update: {},
    create: {
      tenantId: stellarTenant.id,
      email: 'manager@stellartech.com.gh',
      password: await hash('Manager123!'),
      firstName: 'Nana',
      lastName: 'Osei',
      role: 'EMPLOYEE',
      companyRoleId: stellarManagerRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222002',
    },
  });

  if (stellarSets['Manager Set']) {
    await prisma.userPermissionSet.upsert({
      where: {
        userId_permissionSetId: {
          userId: stellarManager.id,
          permissionSetId: stellarSets['Manager Set'],
        },
      },
      update: {},
      create: {
        userId: stellarManager.id,
        permissionSetId: stellarSets['Manager Set'],
        grantedBy: stellarAdmin.id,
      },
    });
  }

  const stellarEmployee = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: stellarTenant.id,
        email: 'dev@stellartech.com.gh',
      },
    },
    update: {},
    create: {
      tenantId: stellarTenant.id,
      email: 'dev@stellartech.com.gh',
      password: await hash('Employee123!'),
      firstName: 'Adjoa',
      lastName: 'Boakye',
      role: 'EMPLOYEE',
      companyRoleId: stellarEmployeeRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222003',
    },
  });

  if (stellarSets['Employee Set']) {
    await prisma.userPermissionSet.upsert({
      where: {
        userId_permissionSetId: {
          userId: stellarEmployee.id,
          permissionSetId: stellarSets['Employee Set'],
        },
      },
      update: {},
      create: {
        userId: stellarEmployee.id,
        permissionSetId: stellarSets['Employee Set'],
        grantedBy: stellarAdmin.id,
      },
    });
  }

  console.log('  ✅ admin@stellartech.com.gh / Admin123!');
  console.log(
    '  ✅ manager@stellartech.com.gh / Manager123! → Manager Set assigned',
  );
  console.log(
    '  ✅ dev@stellartech.com.gh / Employee123! → Employee Set assigned',
  );

  // ── 4. GOLDEN HARVEST (PENDING) ───────────────────────────────────────────
  console.log('\nCreating Golden Harvest Foods (pending)...');
  const pendingTenant = await prisma.tenant.upsert({
    where: { slug: 'golden-harvest' },
    update: {},
    create: {
      name: 'Golden Harvest Foods',
      slug: 'golden-harvest',
      email: 'admin@goldenharvestfoods.com',
      country: 'GH',
      status: 'PENDING',
      industry: 'Food & Beverage',
      size: '50-100',
    },
  });
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: pendingTenant.id,
        email: 'admin@goldenharvestfoods.com',
      },
    },
    update: {},
    create: {
      tenantId: pendingTenant.id,
      email: 'admin@goldenharvestfoods.com',
      password: await hash('Admin123!'),
      firstName: 'Kwabena',
      lastName: 'Frimpong',
      role: 'TENANT_ADMIN',
      status: 'PENDING_VERIFICATION',
    },
  });
  console.log('  ✅ PENDING — approve via: PATCH /tenants/{id}/approve');

  // ── 5. SUNRISE IMPORTS (SUSPENDED) ────────────────────────────────────────
  console.log('\nCreating Sunrise Imports (suspended)...');
  const suspendedTenant = await prisma.tenant.upsert({
    where: { slug: 'sunrise-imports' },
    update: {},
    create: {
      name: 'Sunrise Imports Ltd',
      slug: 'sunrise-imports',
      email: 'admin@sunriseimports.com',
      country: 'GH',
      status: 'SUSPENDED',
      industry: 'Import/Export',
      size: '10-50',
    },
  });
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: suspendedTenant.id,
        email: 'admin@sunriseimports.com',
      },
    },
    update: {},
    create: {
      tenantId: suspendedTenant.id,
      email: 'admin@sunriseimports.com',
      password: await hash('Admin123!'),
      firstName: 'Esi',
      lastName: 'Amoah',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  console.log('  ✅ SUSPENDED — login returns 403');

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(65));
  console.log('✅ SEED COMPLETE\n');
  console.log('Resources seeded:     ' + Object.keys(resources).length);
  console.log('System Roles (3):     SUPER_ADMIN | TENANT_ADMIN | EMPLOYEE');
  console.log(
    'Company Roles:        Company Admin | Manager | Employee (per tenant)',
  );
  console.log(
    'Permission Sets:      Company Admin Set | Manager Set | Employee Set (per tenant)',
  );
  console.log('='.repeat(65));
  console.log('\nSuperAdmin:           superadmin@datrix.com / SuperAdmin123!');
  console.log('\nAcme Ghana (acme-ghana):');
  console.log('  Admin (TENANT_ADMIN): admin@acmeghana.com / Admin123!');
  console.log('  Manager + Set:        hr.manager@acmeghana.com / Manager123!');
  console.log(
    '  Employee + Set:       kofi.boateng@acmeghana.com / Employee123!',
  );
  console.log('  Employee:             ama.owusu@acmeghana.com / Employee123!');
  console.log('\nStellar Tech (stellar-tech):');
  console.log('  Admin (TENANT_ADMIN): admin@stellartech.com.gh / Admin123!');
  console.log(
    '  Manager + Set:        manager@stellartech.com.gh / Manager123!',
  );
  console.log('  Employee + Set:       dev@stellartech.com.gh / Employee123!');
  console.log('\nGolden Harvest (golden-harvest): PENDING');
  console.log('Sunrise Imports (sunrise-imports): SUSPENDED');
  console.log('='.repeat(65));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

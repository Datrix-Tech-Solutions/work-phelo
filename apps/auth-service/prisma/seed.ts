import { PrismaClient } from '../prisma/generated/client';
import * as bcrypt from 'bcrypt';
import { seedResources } from './seed-resources';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

const EMPLOYEE_SET: Record<string, string[]> = {
  'employee-profile': ['VIEW', 'EDIT'],
  leave: ['VIEW', 'CREATE'],
  attendance: ['CREATE'],
  'time-corrections': ['CREATE'],
  projects: ['VIEW'],
  payroll: ['VIEW'],
  appraisals: ['VIEW', 'EDIT'],
};

const COMPANY_ADMIN_SET: Record<string, string[]> = {
  users: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  'company-roles': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  'permission-sets': ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'ASSIGN'],
  'audit-logs': ['VIEW'],
  employees: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'],
  'employee-profile': ['VIEW', 'EDIT'],
  departments: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  branches: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  leave: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
  attendance: ['VIEW', 'CREATE'],
  'time-corrections': ['VIEW', 'CREATE', 'APPROVE'],
  timesheets: ['VIEW', 'APPROVE'],
  schedules: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
  projects: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN'],
  payroll: ['VIEW', 'RUN', 'APPROVE', 'EDIT'],
  assets: ['VIEW', 'CREATE', 'EDIT', 'ASSIGN'],
  appraisals: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
  documents: ['VIEW', 'CREATE', 'EDIT'],
};

async function seedTenantPermissionSets(
  tenantId: string,
  resources: Record<string, string>,
) {
  const sets = [
    { name: 'Company Admin Set', perms: COMPANY_ADMIN_SET, isSystem: true },
    { name: 'Employee Set', perms: EMPLOYEE_SET, isSystem: true },
  ];

  const createdSets: Record<string, string> = {};

  for (const set of sets) {
    const permSetResources: { resourceId: string; action: any }[] = [];
    for (const [resourceName, actions] of Object.entries(set.perms)) {
      const resourceId = resources[resourceName];
      if (!resourceId) continue;
      for (const action of actions) {
        permSetResources.push({ resourceId, action });
      }
    }

    const existing = await prisma.permissionSet.findUnique({
      where: { tenantId_name: { tenantId, name: set.name } },
    });

    if (existing) {
      // Re-sync resources in case the set was created empty or perms changed
      await prisma.permissionSetResource.deleteMany({
        where: { permissionSetId: existing.id },
      });
      if (permSetResources.length > 0) {
        await prisma.permissionSetResource.createMany({
          data: permSetResources.map((r) => ({
            permissionSetId: existing.id,
            resourceId: r.resourceId,
            action: r.action,
          })),
        });
      }
      createdSets[set.name] = existing.id;
      continue;
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

// ── Platform seed — runs in all environments ───────────────────────────────

async function seedPlatform(resources: Record<string, string>) {
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
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
    },
  });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars are required',
    );
  }

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: datrixTenant.id, email: superAdminEmail },
    },
    update: {},
    create: {
      tenantId: datrixTenant.id,
      email: superAdminEmail,
      password: await hash(superAdminPassword),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`  SuperAdmin: ${superAdminEmail}`);

  await seedTenantPermissionSets(datrixTenant.id, resources);
}

// ── Demo seed — dev and staging only ──────────────────────────────────────

async function seedDemo(resources: Record<string, string>) {
  // ── ACME GHANA ─────────────────────────────────────────────────────────────
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
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
    },
  });

  const acmeAdminRole = await prisma.companyRole.upsert({
    where: {
      tenantId_name: { tenantId: acmeTenant.id, name: 'Company Admin' },
    },
    update: {},
    create: { tenantId: acmeTenant.id, name: 'Company Admin', isSystem: true },
  });
  const acmeEmployeeRole = await prisma.companyRole.upsert({
    where: { tenantId_name: { tenantId: acmeTenant.id, name: 'Employee' } },
    update: {},
    create: { tenantId: acmeTenant.id, name: 'Employee', isSystem: true },
  });

  const acmeSets = await seedTenantPermissionSets(acmeTenant.id, resources);

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
      companyRoleId: acmeEmployeeRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111002',
    },
  });

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

  await prisma.user.upsert({
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
      companyRoleId: acmeEmployeeRole.id,
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

  // Assign Employee Set to all remaining acme employees that don't have it yet
  if (acmeSets['Employee Set']) {
    const acmeEmployeesWithoutSet = [acmeEmp2.id];
    // accountant, newuser, mfa.user, invited — fetch their IDs
    const extraAcmeEmps = await prisma.user.findMany({
      where: {
        tenantId: acmeTenant.id,
        email: {
          in: [
            'accountant@acmeghana.com',
            'newuser@acmeghana.com',
            'mfa.user@acmeghana.com',
            'invited@acmeghana.com',
          ],
        },
      },
      select: { id: true },
    });
    for (const emp of [
      ...acmeEmployeesWithoutSet.map((id) => ({ id })),
      ...extraAcmeEmps,
    ]) {
      await prisma.userPermissionSet.upsert({
        where: {
          userId_permissionSetId: {
            userId: emp.id,
            permissionSetId: acmeSets['Employee Set'],
          },
        },
        update: {},
        create: {
          userId: emp.id,
          permissionSetId: acmeSets['Employee Set'],
          grantedBy: acmeAdmin.id,
        },
      });
    }
  }

  console.log('  admin@acmeghana.com / Admin123! (TENANT_ADMIN)');
  console.log('  hr.manager@acmeghana.com / Manager123!');
  console.log('  kofi.boateng@acmeghana.com / Employee123!');
  console.log('  ama.owusu@acmeghana.com / Employee123!');
  console.log('  accountant@acmeghana.com / Accountant123!');
  console.log('  newuser@acmeghana.com / TempPass123! (force reset)');
  console.log('  mfa.user@acmeghana.com / MfaUser123!');

  // ── STELLAR TECH ───────────────────────────────────────────────────────────
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
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
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
      companyRoleId: stellarEmployeeRole.id,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222002',
    },
  });

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

  console.log('  admin@stellartech.com.gh / Admin123!');
  console.log('  manager@stellartech.com.gh / Manager123!');
  console.log('  dev@stellartech.com.gh / Employee123!');

  // ── GOLDEN HARVEST (PENDING) ───────────────────────────────────────────────
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
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
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
  console.log('  PENDING — approve via: PATCH /tenants/{id}/approve');

  // ── SUNRISE IMPORTS (SUSPENDED) ───────────────────────────────────────────
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
      moduleConfig: { hr: false, accounting: false, marketing: false },
      featureConfig: {
        hr: {
          leave: false,
          time: false,
          payroll: false,
          appraisals: false,
          projects: false,
          assets: false,
        },
        marketing: { leads: false, pipeline: false, contacts: false },
      },
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
  console.log('  SUSPENDED — login returns 403');
}

// ── Entry point ────────────────────────────────────────────────────────────

async function main() {
  const isProd = process.env.NODE_ENV === 'production';

  console.log('Starting seed...');
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}\n`);

  console.log('Seeding platform resources...');
  const resources = await seedResources();

  await seedPlatform(resources);

  if (!isProd) {
    console.log('\nSeeding demo tenants (non-production)...');
    await seedDemo(resources);
  } else {
    console.log('\nProduction environment — skipping demo tenants.');
  }

  console.log('\n' + '='.repeat(65));
  console.log(' SEED COMPLETE');
  console.log('='.repeat(65));
  console.log(`Resources:   ${Object.keys(resources).length}`);
  console.log(`SuperAdmin:  ${process.env.SUPER_ADMIN_EMAIL}`);
  if (!isProd) {
    console.log(
      'Demo tenants: acme-ghana, stellar-tech, golden-harvest, sunrise-imports',
    );
  }
  console.log('='.repeat(65));
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

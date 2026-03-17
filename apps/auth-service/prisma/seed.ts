import { PrismaClient } from '../prisma/generated/client';
import * as bcrypt from 'bcrypt';
import { COMPANY_ROLE_PERMISSIONS } from '@work-phelo/config';

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

async function seedCompanyRoles(
  tenantId: string,
): Promise<Record<string, string>> {
  const roleNames = ['Company Admin', 'Manager', 'Employee'];
  const roles: Record<string, string> = {};

  for (const name of roleNames) {
    const permissions = COMPANY_ROLE_PERMISSIONS[name] || [];
    const role = await prisma.companyRole.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: {
        tenantId,
        name,
        isSystem: true,
        permissions: {
          create: permissions.map((p: string) => ({ permission: p })),
        },
      },
    });
    roles[name] = role.id;
  }

  return roles;
}

async function main() {
  console.log('🌱 Starting seed...\n');

  // ── 1. DATRIX INTERNAL (SuperAdmin) ──────────────────────────────────────
  console.log('Creating Datrix internal tenant...');
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
  console.log('  ✅ SuperAdmin: superadmin@datrix.com / SuperAdmin123!');

  // ── 2. ACME GHANA ─────────────────────────────────────────────────────────
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

  const acmeRoles = await seedCompanyRoles(acmeTenant.id);
  console.log('  ✅ Company roles seeded: Company Admin, Manager, Employee');

  // TENANT_ADMIN — no company role needed
  await prisma.user.upsert({
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

  // EMPLOYEE with Manager company role
  await prisma.user.upsert({
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
      companyRoleId: acmeRoles['Manager'],
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111002',
    },
  });

  // EMPLOYEE with Employee company role
  await prisma.user.upsert({
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
      companyRoleId: acmeRoles['Employee'],
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244111003',
    },
  });

  await prisma.user.upsert({
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
      companyRoleId: acmeRoles['Employee'],
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
      companyRoleId: acmeRoles['Manager'],
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
      companyRoleId: acmeRoles['Employee'],
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
      companyRoleId: acmeRoles['Employee'],
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
      companyRoleId: acmeRoles['Employee'],
      status: 'PENDING_VERIFICATION',
      forcePasswordReset: true,
      inviteToken: 'demo-invite-token-acme-ghana-2026',
      inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  console.log(
    '  ✅ Admin (TENANT_ADMIN):              admin@acmeghana.com / Admin123!',
  );
  console.log(
    '  ✅ Manager (EMPLOYEE + Manager):      hr.manager@acmeghana.com / Manager123!',
  );
  console.log(
    '  ✅ Employee 1 (EMPLOYEE + Employee):  kofi.boateng@acmeghana.com / Employee123!',
  );
  console.log(
    '  ✅ Employee 2 (EMPLOYEE + Employee):  ama.owusu@acmeghana.com / Employee123!',
  );
  console.log(
    '  ✅ Accountant (EMPLOYEE + Manager):   accountant@acmeghana.com / Accountant123!',
  );
  console.log(
    '  ✅ Force Reset:                       newuser@acmeghana.com / TempPass123!',
  );
  console.log(
    '  ✅ MFA Demo:                          mfa.user@acmeghana.com / MfaUser123!',
  );

  // ── 3. STELLAR TECH ───────────────────────────────────────────────────────
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

  const stellarRoles = await seedCompanyRoles(stellarTenant.id);

  await prisma.user.upsert({
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

  await prisma.user.upsert({
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
      companyRoleId: stellarRoles['Manager'],
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222002',
    },
  });

  await prisma.user.upsert({
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
      companyRoleId: stellarRoles['Employee'],
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: '+233244222003',
    },
  });

  console.log(
    '  ✅ Admin (TENANT_ADMIN):              admin@stellartech.com.gh / Admin123!',
  );
  console.log(
    '  ✅ Manager (EMPLOYEE + Manager):      manager@stellartech.com.gh / Manager123!',
  );
  console.log(
    '  ✅ Employee (EMPLOYEE + Employee):    dev@stellartech.com.gh / Employee123!',
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
  console.log('System Roles (3):  SUPER_ADMIN | TENANT_ADMIN | EMPLOYEE');
  console.log(
    'Company Roles (3 per tenant): Company Admin | Manager | Employee',
  );
  console.log('='.repeat(65));
  console.log('\nSuperAdmin:         superadmin@datrix.com / SuperAdmin123!');
  console.log('\nAcme Ghana (acme-ghana):');
  console.log('  Admin:            admin@acmeghana.com / Admin123!');
  console.log('  Manager:          hr.manager@acmeghana.com / Manager123!');
  console.log('  Employee 1:       kofi.boateng@acmeghana.com / Employee123!');
  console.log('  Employee 2:       ama.owusu@acmeghana.com / Employee123!');
  console.log('\nStellar Tech (stellar-tech):');
  console.log('  Admin:            admin@stellartech.com.gh / Admin123!');
  console.log('  Manager:          manager@stellartech.com.gh / Manager123!');
  console.log('  Employee:         dev@stellartech.com.gh / Employee123!');
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

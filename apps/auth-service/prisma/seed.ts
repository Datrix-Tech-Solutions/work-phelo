import { PrismaClient } from '../prisma/generated/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SuperAdmin...');

  const existing = await prisma.tenant.findUnique({
    where: { slug: 'datrix-internal' },
  });

  let tenant = existing;

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Datrix Internal',
        slug: 'datrix-internal',
        email: 'internal@datrix.com',
        status: 'ACTIVE',
        country: 'GH',
      },
    });
    console.log('Created Datrix internal tenant:', tenant.id);
  }

  const existingAdmin = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'superadmin@datrix.com' },
    },
  });

  if (existingAdmin) {
    console.log('SuperAdmin already exists, skipping.');
    return;
  }

  const hashedPassword = await bcrypt.hash('SuperAdmin123!', 12);

  const superAdmin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'superadmin@datrix.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  console.log('SuperAdmin created successfully!');
  console.log('Email:', superAdmin.email);
  console.log('Password: SuperAdmin123!');
  console.log('Change this password immediately after first login!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

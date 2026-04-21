import { PrismaClient } from '../prisma/generated/client';

const prisma = new PrismaClient();

export const RESOURCES = [
  // ── AUTH module ────────────────────────────────────────────────
  {
    name: 'users',
    module: 'AUTH',
    description: 'User accounts and invitations',
  },
  { name: 'tenants', module: 'AUTH', description: 'Company tenants' },
  {
    name: 'company-roles',
    module: 'AUTH',
    description: 'Company role definitions',
  },
  {
    name: 'permission-sets',
    module: 'AUTH',
    description: 'Permission set bundles',
  },
  { name: 'audit-logs', module: 'AUTH', description: 'Audit trail' },

  // ── HR module ──────────────────────────────────────────────────
  { name: 'employees', module: 'HR', description: 'Employee profiles' },
  { name: 'departments', module: 'HR', description: 'Department management' },
  { name: 'branches', module: 'HR', description: 'Branch locations' },
  { name: 'leave', module: 'HR', description: 'Leave requests and types' },
  { name: 'attendance', module: 'HR', description: 'Clock-in/out records' },
  { name: 'timesheets', module: 'HR', description: 'Weekly timesheets' },
  {
    name: 'time-corrections',
    module: 'HR',
    description: 'Time correction requests',
  },
  { name: 'schedules', module: 'HR', description: 'Shift schedules' },
  { name: 'payroll', module: 'HR', description: 'Payroll runs and payslips' },
  { name: 'appraisals', module: 'HR', description: 'Performance appraisals' },
  { name: 'documents', module: 'HR', description: 'Employee documents' },
  { name: 'allowances', module: 'HR', description: 'Employee allowances' },

  // ── FINANCE module ─────────────────────────────────────────────
  {
    name: 'payroll-reports',
    module: 'FINANCE',
    description: 'Payroll financial reports',
  },
  {
    name: 'expense-reports',
    module: 'FINANCE',
    description: 'Expense reports',
  },

  // ── PLATFORM module ────────────────────────────────────────────
  {
    name: 'platform-settings',
    module: 'PLATFORM',
    description: 'Platform configuration',
  },
  {
    name: 'subscriptions',
    module: 'PLATFORM',
    description: 'Subscription management',
  },
];

export async function seedResources() {
  console.log('  Seeding resources...');
  const results: Record<string, string> = {};

  for (const resource of RESOURCES) {
    const r = await prisma.resource.upsert({
      where: { name: resource.name },
      update: { module: resource.module, description: resource.description },
      create: resource,
    });
    results[resource.name] = r.id;
  }

  console.log(`  ${Object.keys(results).length} resources seeded`);
  return results;
}

if (require.main === module) {
  seedResources()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

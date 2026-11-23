import { PrismaService } from '../prisma/prisma.service';
import { SystemPermissionBackfillService } from '../permissions/system-permission-backfill.service';

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    if (!args[index + 1] || args[index + 1].startsWith('--'))
      throw new Error('Missing reconciliation option value');
    return args[index + 1];
  };
  for (const arg of args.filter((a) => a.startsWith('--')))
    if (!['--execute', '--tenant', '--after', '--limit'].includes(arg))
      throw new Error('Unknown reconciliation option');
  const options = {
    execute: args.includes('--execute'),
    tenantId: value('--tenant'),
    afterTenantId: value('--after'),
    limit: value('--limit') ? Number(value('--limit')) : undefined,
  };
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const result = await new SystemPermissionBackfillService(prisma).run(
      options,
    );
    console.log(JSON.stringify(result));
    if ('busy' in result && result.busy) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.error(
    'Permission reconciliation did not complete; inspect sanitized job diagnostics and resume cursor.',
  );
  process.exitCode = 1;
});

import { PrismaClient } from '../prisma/generated/client';
import { RESOURCES } from '../src/permissions/resource-definitions';

const prisma = new PrismaClient();

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

'use strict';
// Use the service's configured database; never print its URL or tenant identity.
const { AiDatabaseService, createAiClient } = require('../dist/persistence/ai-database.service');
const {
  ResourceReconciliationService,
} = require('../dist/persistence/resource-reconciliation.service');
const { parseRuntimeEnv } = require('../dist/config/runtime-env');
(async () => {
  const tenant = process.argv[2];
  const options = process.argv.slice(3);
  const restart = options.includes('--restart-completed');
  const size = options.find((option) => option.startsWith('--batch-size='));
  if (
    !tenant ||
    new Set(options).size !== options.length ||
    options.filter((option) => option.startsWith('--batch-size=')).length > 1 ||
    options.some(
      (option) => option !== '--restart-completed' && !/^--batch-size=[1-9][0-9]*$/.test(option),
    )
  )
    throw new Error('Expected tenant identifier, optional --restart-completed and --batch-size');
  const batchSize = size ? Number(size.split('=')[1]) : 100;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500)
    throw new Error('Invalid batch size');
  const configuration = parseRuntimeEnv(process.env);
  if (!configuration.AI_PERSISTENCE_ENABLED) throw new Error('Persistence must be configured');
  // Outside ConfigModule, Nest ConfigService can prefer raw process strings to
  // parsed booleans. Use only the already validated runtime values here.
  const database = new AiDatabaseService({ get: (name) => configuration[name] }, createAiClient);
  try {
    await database.onModuleInit();
    const result = await new ResourceReconciliationService(database).step(
      tenant,
      batchSize,
      restart,
    );
    console.log(JSON.stringify(result));
  } finally {
    await database.onModuleDestroy();
  }
})().catch(() => {
  console.error('Accounting reconciliation failed; no credentials or source data logged.');
  process.exitCode = 1;
});

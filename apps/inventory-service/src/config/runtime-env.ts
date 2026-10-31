export const inventoryRequiredEnvVars = ['JWT_SECRET'] as const;

export function inventoryServicePort(): number {
  const value = process.env.INVENTORY_SERVICE_PORT ?? '4009';
  if (!/^\d+$/.test(value)) {
    throw new Error('INVENTORY_SERVICE_PORT must be an integer between 1 and 65535');
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('INVENTORY_SERVICE_PORT must be an integer between 1 and 65535');
  }
  return port;
}

export function assertInventoryRuntimeEnv(): void {
  const missing = inventoryRequiredEnvVars.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(
      'Inventory service missing required environment variables: ' + missing.join(', '),
    );
  }
  inventoryServicePort();
}

if (require.main === module) {
  try {
    assertInventoryRuntimeEnv();
    console.log('Inventory service environment validation passed');
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Inventory environment validation failed',
    );
    process.exit(1);
  }
}

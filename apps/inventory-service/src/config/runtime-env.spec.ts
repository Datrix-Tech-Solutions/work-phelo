import { assertInventoryRuntimeEnv, inventoryServicePort } from './runtime-env';

describe('Inventory runtime configuration', () => {
  const previousEnv = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = 'inventory-config-test-secret';
    process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:5432/unused?schema=inventory';
    delete process.env.INVENTORY_SERVICE_PORT;
  });
  afterEach(() => {
    process.env = { ...previousEnv };
  });
  it.each([undefined, '', ' '])('requires a database URL: %p', (value) => {
    if (value === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = value;
    expect(() => assertInventoryRuntimeEnv()).toThrow(
      'missing required environment variables: DATABASE_URL',
    );
  });

  it('defaults to the reserved service port without broker or Redis settings', () => {
    for (const key of ['RABBITMQ_URL', 'REDIS_URL', 'INTERNAL_SERVICE_AUTH_SECRET'])
      delete process.env[key];
    expect(inventoryServicePort()).toBe(4009);
    expect(() => assertInventoryRuntimeEnv()).not.toThrow();
  });
  it.each(['', ' ', 'invalid', '0', '-1', '65536', '4009.5', '4009suffix'])(
    'rejects invalid port %p',
    (value) => {
      process.env.INVENTORY_SERVICE_PORT = value;
      expect(() => assertInventoryRuntimeEnv()).toThrow('INVENTORY_SERVICE_PORT');
    },
  );
  it.each(['1', '4009', '65535'])('accepts explicit port %s', (value) => {
    process.env.INVENTORY_SERVICE_PORT = value;
    expect(inventoryServicePort()).toBe(Number(value));
  });
  it.each([undefined, '', ' '])(
    'rejects missing/blank verification secret %p without exposing it',
    (value) => {
      if (value === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = value;
      expect(() => assertInventoryRuntimeEnv()).toThrow(
        'missing required environment variables: JWT_SECRET',
      );
    },
  );
});

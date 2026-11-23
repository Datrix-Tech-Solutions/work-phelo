const enableShutdownHooks = jest.fn();
const listen = jest.fn().mockResolvedValue(undefined);

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn().mockResolvedValue({
      enableShutdownHooks,
      useGlobalPipes: jest.fn(),
      setGlobalPrefix: jest.fn(),
      listen,
    }),
  },
}));
jest.mock('@work-phelo/config', () => ({ isSwaggerEnabled: () => false }));
jest.mock('./app.module', () => ({ AppModule: class {} }));
jest.mock('./swagger.config', () => ({ setupSwagger: jest.fn() }));

describe('Subscription startup lifecycle', () => {
  it('registers shutdown handling before listening', async () => {
    const originalPort = process.env.PORT;
    process.env.PORT = '4005';
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await jest.isolateModulesAsync(async () => {
        await import('./main');
      });
      expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
      expect(listen).toHaveBeenCalledWith('4005');
      expect(enableShutdownHooks.mock.invocationCallOrder[0]).toBeLessThan(
        listen.mock.invocationCallOrder[0],
      );
    } finally {
      if (originalPort === undefined) delete process.env.PORT;
      else process.env.PORT = originalPort;
      log.mockRestore();
    }
  });
});

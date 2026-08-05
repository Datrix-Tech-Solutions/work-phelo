import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceAccountingOutboxDispatcher } from './reinsurance-accounting-outbox-dispatcher.service';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';

function setEnv(name: string, value: string | undefined) {
  if (value == null) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('ReinsuranceAccountingOutboxDispatcher', () => {
  const originalEnv = process.env;
  let prisma: PrismaService;
  let outbox: jest.Mocked<ReinsuranceAccountingOutboxService>;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env = { ...originalEnv };
    prisma = {} as PrismaService;
    outbox = {
      processPending: jest.fn().mockResolvedValue({
        processedCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        skippedCount: 0,
        events: [],
      }),
    } as unknown as jest.Mocked<ReinsuranceAccountingOutboxService>;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('starts automatically and processes pending events with configured options', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS', '2000');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_BATCH_SIZE', '7');
    setEnv(
      'REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_PROCESSING_TIMEOUT_MS',
      '30000',
    );
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_RETRY_DELAY_MS', '4000');
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_MAX_ATTEMPTS', '4');
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    await Promise.resolve();

    expect(outbox.processPending.mock.calls[0]).toEqual([
      prisma,
      {
        limit: 7,
        maxAttempts: 4,
        processingTimeoutMs: 30000,
        retryDelayMs: 4000,
      },
    ]);
    expect(dispatcher.status()).toMatchObject({
      enabled: true,
      running: true,
      lastError: null,
    });

    await dispatcher.onModuleDestroy();
  });

  it('does not start or process when disabled', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED', 'false');
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    await dispatcher.processBatch('manual');

    expect(outbox.processPending.mock.calls).toHaveLength(0);
    expect(dispatcher.status()).toMatchObject({
      enabled: false,
      running: false,
      inFlight: false,
    });
  });

  it('skips overlapping runs so one worker instance does not double process', async () => {
    let resolveBatch!: () => void;
    outbox.processPending.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = () =>
          resolve({
            processedCount: 1,
            deliveredCount: 1,
            failedCount: 0,
            skippedCount: 0,
            events: [],
          });
      }),
    );
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    const first = dispatcher.processBatch('manual');
    const second = dispatcher.processBatch('manual');

    expect(outbox.processPending.mock.calls).toHaveLength(1);
    resolveBatch();
    await Promise.all([first, second]);
  });

  it('records batch errors without stopping future batches', async () => {
    outbox.processPending
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({
        processedCount: 1,
        deliveredCount: 1,
        failedCount: 0,
        skippedCount: 0,
        events: [],
      });
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    await dispatcher.processBatch('manual');
    expect(dispatcher.status().lastError).toBe('database unavailable');

    await dispatcher.processBatch('manual');
    expect(dispatcher.status()).toMatchObject({
      lastError: null,
      lastResult: {
        processedCount: 1,
        deliveredCount: 1,
        failedCount: 0,
        skippedCount: 0,
        events: [],
      },
    });
  });

  it('clears the interval and waits for in-flight work during shutdown', async () => {
    setEnv('REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS', '2000');
    let resolveBatch!: () => void;
    outbox.processPending.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = () =>
          resolve({
            processedCount: 1,
            deliveredCount: 1,
            failedCount: 0,
            skippedCount: 0,
            events: [],
          });
      }),
    );
    const dispatcher = new ReinsuranceAccountingOutboxDispatcher(
      prisma,
      outbox,
    );

    dispatcher.onApplicationBootstrap();
    const shutdown = dispatcher.onModuleDestroy();
    expect(dispatcher.status().inFlight).toBe(true);

    resolveBatch();
    await shutdown;

    expect(dispatcher.status()).toMatchObject({
      running: false,
      inFlight: false,
    });

    jest.advanceTimersByTime(2000);
    expect(outbox.processPending.mock.calls).toHaveLength(1);
  });
});

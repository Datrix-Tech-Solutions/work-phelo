import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';
import { InferenceRequest } from './inference-provider';
import { MockExecutionConfig, MockInferenceProvider, MockScenario } from './mock.provider';

const config: MockExecutionConfig = {
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  AI_ENABLED: true,
  AI_MOCK_ENABLED: true,
  AI_REQUEST_TIMEOUT_MS: 5000,
};
const request: InferenceRequest = {
  requestId: 'stable-fixture-request',
  messages: [{ role: 'user', content: 'private-do-not-echo' }],
  maxOutputTokens: 100,
};

describe('MockInferenceProvider', () => {
  let controller: AbortController;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1700000000000);
    controller = new AbortController();
  });

  afterEach(() => {
    expect(jest.getTimerCount()).toBe(0);
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function generate(scenario: MockScenario = {}, ceiling = 100) {
    return new MockInferenceProvider(config, scenario).generateText(
      { ...request, maxOutputTokens: ceiling },
      { signal: controller.signal, deadlineAtMs: Date.now() + 1000 },
    );
  }

  it('returns deterministic, explicitly synthetic, non-billable results without input echo', async () => {
    const first = generate();
    await jest.runAllTimersAsync();
    const result = await first;
    expect(result).toEqual({
      provider: 'mock',
      model: 'deterministic-mock-v1',
      synthetic: true,
      text: 'Synthetic test response; no AI provider was contacted.',
      finishReason: 'completed',
      usage: { inputTokens: null, outputTokens: 8, source: 'synthetic', billing: 'NON_BILLABLE' },
    });
    expect(JSON.stringify(result)).not.toContain('private-do-not-echo');
    const second = generate();
    await jest.runAllTimersAsync();
    expect(await second).toEqual(result);
  });

  it('respects the output ceiling using explicitly synthetic word counts', async () => {
    const pending = generate({}, 2);
    await jest.runAllTimersAsync();
    expect(await pending).toMatchObject({
      text: 'Synthetic test',
      finishReason: 'length',
      usage: { outputTokens: 2, billing: 'NON_BILLABLE' },
    });
  });

  it('does not inspect message content or log prompts', async () => {
    const log = jest.spyOn(console, 'log');
    const error = jest.spyOn(console, 'error');
    const input = {
      ...request,
      get messages(): InferenceRequest['messages'] {
        throw new Error('Must not inspect prompts');
      },
    };
    const pending = new MockInferenceProvider(config).generateText(input, {
      signal: controller.signal,
      deadlineAtMs: Date.now() + 1000,
    });
    await jest.runAllTimersAsync();
    expect((await pending).synthetic).toBe(true);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('makes unexpected network egress fail explicitly', async () => {
    const deny = () => {
      throw new Error('Unexpected network egress');
    };
    const spies = [
      jest.spyOn(http, 'request').mockImplementation(deny),
      jest.spyOn(http, 'get').mockImplementation(deny),
      jest.spyOn(https, 'request').mockImplementation(deny),
      jest.spyOn(https, 'get').mockImplementation(deny),
      jest.spyOn(net, 'connect').mockImplementation(deny),
      jest.spyOn(net, 'createConnection').mockImplementation(deny),
      jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(deny),
      jest.spyOn(tls, 'connect').mockImplementation(deny),
      jest.spyOn(globalThis, 'fetch').mockImplementation(deny),
    ];
    const pending = generate();
    await jest.runAllTimersAsync();
    expect((await pending).provider).toBe('mock');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('rejects an already-aborted request without scheduling timers', async () => {
    controller.abort('private-cancellation-reason');
    await expect(generate()).rejects.toMatchObject({
      code: 'CANCELLED',
      submissionState: 'NOT_SUBMITTED',
      retry: 'NEVER',
    });
  });

  it('cancels in progress and removes its abort listener and both timers', async () => {
    const add = jest.spyOn(controller.signal, 'addEventListener');
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const pending = generate({ delayMs: 100 });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(jest.getTimerCount()).toBe(2);
    controller.abort('private-reason');
    await rejected;
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
  });

  it('rejects an expired absolute deadline immediately', async () => {
    await expect(
      new MockInferenceProvider(config).generateText(request, {
        signal: controller.signal,
        deadlineAtMs: Date.now(),
      }),
    ).rejects.toMatchObject({ code: 'DEADLINE_EXCEEDED' });
  });

  it('expires in flight and cleans timers/listeners', async () => {
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const pending = generate({ delayMs: 2000 });
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'DEADLINE_EXCEEDED',
      retry: 'AFTER_BACKOFF',
      submissionState: 'NOT_SUBMITTED',
    });
    await jest.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('also caps execution at the configured service timeout', async () => {
    const pending = new MockInferenceProvider(
      { ...config, AI_REQUEST_TIMEOUT_MS: 10 },
      { delayMs: 100 },
    ).generateText(request, { signal: controller.signal, deadlineAtMs: Date.now() + 1000 });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'DEADLINE_EXCEEDED' });
    await jest.advanceTimersByTimeAsync(10);
    await rejected;
  });

  it('does not complete after an event-loop/clock jump beyond the deadline', async () => {
    const pending = generate({ delayMs: 10 });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'DEADLINE_EXCEEDED' });
    jest.setSystemTime(Date.now() + 2000);
    await jest.advanceTimersByTimeAsync(10);
    await rejected;
  });

  it.each(['UNAVAILABLE', 'INVALID_RESPONSE'] as const)(
    'injects %s safely and cleans up',
    async (failure) => {
      const remove = jest.spyOn(controller.signal, 'removeEventListener');
      const pending = generate({ failure });
      const rejected = expect(pending).rejects.toMatchObject({
        code: failure,
        submissionState: 'NOT_SUBMITTED',
      });
      await jest.runAllTimersAsync();
      await rejected;
      expect(remove).toHaveBeenCalledTimes(1);
    },
  );

  it('cleans up on success and ignores later cancellation', async () => {
    const remove = jest.spyOn(controller.signal, 'removeEventListener');
    const pending = generate();
    await jest.runAllTimersAsync();
    const result = await pending;
    controller.abort();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await pending).toBe(result);
  });

  it.each([0, -1, 1.5, NaN, Infinity])(
    'rejects invalid output ceiling %s without timers',
    async (ceiling) => {
      await expect(generate({}, ceiling)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    },
  );

  it.each([NaN, Infinity, -Infinity])(
    'rejects invalid deadline %s without timers',
    async (deadlineAtMs) => {
      await expect(
        new MockInferenceProvider(config).generateText(request, {
          signal: controller.signal,
          deadlineAtMs,
        }),
      ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    },
  );

  it('copies execution configuration so subsequent mutation cannot enable a disabled provider', async () => {
    const settings = { ...config, AI_ENABLED: false };
    const provider = new MockInferenceProvider(settings);
    settings.AI_ENABLED = true;
    await expect(
      provider.generateText(request, {
        signal: controller.signal,
        deadlineAtMs: Date.now() + 1000,
      }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});

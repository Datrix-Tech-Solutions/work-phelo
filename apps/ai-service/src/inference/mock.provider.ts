import { AiRuntimeConfig } from '../config/runtime-env';
import {
  InferenceOptions,
  InferenceProvider,
  InferenceRequest,
  InferenceResult,
} from './inference-provider';
import { InferenceProviderError } from './provider-error';
import { demoGuidance } from './demo-guidance';

export type MockExecutionConfig = Pick<
  AiRuntimeConfig,
  'NODE_ENV' | 'AI_PROVIDER' | 'AI_ENABLED' | 'AI_MOCK_ENABLED' | 'AI_REQUEST_TIMEOUT_MS'
> & { AI_INTERNAL_DEMO_ENABLED?: boolean; AI_RUNTIME_SCOPE?: string };

// Constructor-only fixtures are not exposed through environment variables or HTTP.
export interface MockScenario {
  readonly delayMs?: number;
  readonly failure?: 'UNAVAILABLE' | 'INVALID_RESPONSE';
}

const response = 'Synthetic test response; no AI provider was contacted.';

export class MockInferenceProvider implements InferenceProvider {
  private readonly config: Readonly<MockExecutionConfig>;
  private readonly scenario: Readonly<MockScenario>;

  constructor(config: MockExecutionConfig, scenario: MockScenario = {}) {
    if (
      (config.AI_INTERNAL_DEMO_ENABLED === true &&
        (config.NODE_ENV === 'production' || config.AI_RUNTIME_SCOPE !== 'isolated-demo')) ||
      config.AI_PROVIDER !== 'mock' ||
      !['development', 'test', 'production'].includes(config.NODE_ENV) ||
      (config.NODE_ENV === 'production' && (config.AI_ENABLED || config.AI_MOCK_ENABLED)) ||
      !Number.isInteger(config.AI_REQUEST_TIMEOUT_MS) ||
      config.AI_REQUEST_TIMEOUT_MS < 1 ||
      config.AI_REQUEST_TIMEOUT_MS > 25000 ||
      (scenario.delayMs !== undefined &&
        (!Number.isInteger(scenario.delayMs) ||
          scenario.delayMs < 0 ||
          scenario.delayMs > 2147483647))
    ) {
      throw new InferenceProviderError('UNAVAILABLE', 'NOT_SUBMITTED');
    }
    this.config = Object.freeze({ ...config });
    this.scenario = Object.freeze({ ...scenario });
  }

  async generateText(
    request: InferenceRequest,
    options: InferenceOptions,
  ): Promise<InferenceResult> {
    if (
      !['development', 'test'].includes(this.config.NODE_ENV) ||
      this.config.AI_ENABLED !== true ||
      this.config.AI_MOCK_ENABLED !== true
    ) {
      throw new InferenceProviderError('UNAVAILABLE', 'NOT_SUBMITTED');
    }
    if (options.signal.aborted) throw new InferenceProviderError('CANCELLED', 'NOT_SUBMITTED');
    if (
      !Number.isFinite(options.deadlineAtMs) ||
      !Number.isSafeInteger(request.maxOutputTokens) ||
      request.maxOutputTokens < 1
    ) {
      throw new InferenceProviderError('UNAVAILABLE', 'NOT_SUBMITTED');
    }
    const deadline = Math.min(options.deadlineAtMs, Date.now() + this.config.AI_REQUEST_TIMEOUT_MS);
    if (deadline <= Date.now())
      throw new InferenceProviderError('DEADLINE_EXCEEDED', 'NOT_SUBMITTED');
    const ceiling = request.maxOutputTokens;
    const demo = this.config.AI_INTERNAL_DEMO_ENABLED === true;
    const text = demo ? demoGuidance(request) : response;
    if (!text) throw new InferenceProviderError('UNAVAILABLE', 'NOT_SUBMITTED');

    return new Promise<InferenceResult>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(completionTimer);
        clearTimeout(deadlineTimer);
        options.signal.removeEventListener('abort', cancel);
      };
      const fail = (
        code: 'CANCELLED' | 'DEADLINE_EXCEEDED' | 'UNAVAILABLE' | 'INVALID_RESPONSE',
      ) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new InferenceProviderError(code, 'NOT_SUBMITTED'));
      };
      const cancel = () => fail('CANCELLED');
      options.signal.addEventListener('abort', cancel, { once: true });
      const deadlineTimer = setTimeout(() => fail('DEADLINE_EXCEEDED'), deadline - Date.now());
      const completionTimer = setTimeout(() => {
        if (settled) return;
        // Recheck after event-loop stalls rather than trusting timer ordering.
        if (options.signal.aborted) return fail('CANCELLED');
        if (Date.now() >= deadline) return fail('DEADLINE_EXCEEDED');
        if (this.scenario.failure) return fail(this.scenario.failure);
        const words = text.split(' ');
        const selected = words.slice(0, ceiling);
        settled = true;
        cleanup();
        resolve({
          provider: 'mock',
          model: demo ? 'deterministic-workphelo-demo-v1' : 'deterministic-mock-v1',
          synthetic: true,
          text: selected.join(' '),
          finishReason: selected.length < words.length ? 'length' : 'completed',
          usage: {
            inputTokens: null,
            // Mock tokens are whitespace-delimited fixture words, not model measurements.
            outputTokens: selected.length,
            source: 'synthetic',
            billing: 'NON_BILLABLE',
          },
        });
      }, this.scenario.delayMs ?? 0);
    });
  }
}

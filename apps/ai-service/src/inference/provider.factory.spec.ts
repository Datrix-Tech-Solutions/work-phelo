import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { InferenceProvider, INFERENCE_PROVIDER } from './inference-provider';
import { MockExecutionConfig, MockInferenceProvider } from './mock.provider';
import { createInferenceProvider } from './provider.factory';

const enabled: MockExecutionConfig = {
  NODE_ENV: 'test',
  AI_PROVIDER: 'mock',
  AI_ENABLED: true,
  AI_MOCK_ENABLED: true,
  AI_REQUEST_TIMEOUT_MS: 5000,
};

describe('Inference provider factory', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('selects only the mock provider', () => {
    expect(createInferenceProvider(enabled)).toBeInstanceOf(MockInferenceProvider);
  });

  it.each(['openai', 'anthropic', 'bedrock', 'unknown'])(
    'rejects %s without fallback',
    (provider) => {
      expect(() =>
        createInferenceProvider({ ...enabled, AI_PROVIDER: provider as 'mock' }),
      ).toThrow('Inference provider unavailable');
    },
  );

  it.each([
    [false, false],
    [true, false],
    [false, true],
  ])('requires both flags (%s, %s)', async (AI_ENABLED, AI_MOCK_ENABLED) => {
    const provider = createInferenceProvider({ ...enabled, AI_ENABLED, AI_MOCK_ENABLED });
    await expect(
      provider.generateText(
        { requestId: 'test', messages: [], maxOutputTokens: 10 },
        { signal: new AbortController().signal, deadlineAtMs: Date.now() + 100 },
      ),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])('rejects production enablement (%s, %s)', (AI_ENABLED, AI_MOCK_ENABLED) => {
    expect(() =>
      createInferenceProvider({ ...enabled, NODE_ENV: 'production', AI_ENABLED, AI_MOCK_ENABLED }),
    ).toThrow('Inference provider unavailable');
  });

  it('never executes even a disabled production provider', async () => {
    const provider = createInferenceProvider({
      ...enabled,
      NODE_ENV: 'production',
      AI_ENABLED: false,
      AI_MOCK_ENABLED: false,
    });
    await expect(
      provider.generateText(
        { requestId: 'test', messages: [], maxOutputTokens: 10 },
        { signal: new AbortController().signal, deadlineAtMs: Date.now() + 100 },
      ),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('cannot enable a production instance by mutating its original configuration', async () => {
    const settings: MockExecutionConfig = {
      ...enabled,
      NODE_ENV: 'production',
      AI_ENABLED: false,
      AI_MOCK_ENABLED: false,
    };
    const provider = createInferenceProvider(settings);
    settings.NODE_ENV = 'test';
    settings.AI_ENABLED = true;
    settings.AI_MOCK_ENABLED = true;
    settings.AI_PROVIDER = 'external' as 'mock';
    await expect(
      provider.generateText(
        { requestId: 'test', messages: [], maxOutputTokens: 10 },
        { signal: new AbortController().signal, deadlineAtMs: Date.now() + 100 },
      ),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('provides the inert factory through Nest DI without credentials', async () => {
    process.env = { NODE_ENV: 'test', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'fixture-v1' };
    const module = await Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true })],
    }).compile();
    try {
      const provider = module.get<InferenceProvider>(INFERENCE_PROVIDER);
      expect(provider).toBeInstanceOf(MockInferenceProvider);
      await expect(
        provider.generateText(
          { requestId: 'test', messages: [], maxOutputTokens: 10 },
          { signal: new AbortController().signal, deadlineAtMs: Date.now() + 100 },
        ),
      ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    } finally {
      await module.close();
    }
  });

  it('supports controlled DI replacement without exposing failure switches', async () => {
    process.env = { NODE_ENV: 'test', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'fixture-v1' };
    const fixture = new MockInferenceProvider(enabled, { failure: 'UNAVAILABLE' });
    const module = await Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true })],
    })
      .overrideProvider(INFERENCE_PROVIDER)
      .useValue(fixture)
      .compile();
    try {
      await expect(
        module
          .get<InferenceProvider>(INFERENCE_PROVIDER)
          .generateText(
            { requestId: 'test', messages: [], maxOutputTokens: 10 },
            { signal: new AbortController().signal, deadlineAtMs: Date.now() + 1000 },
          ),
      ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    } finally {
      await module.close();
    }
  });
});

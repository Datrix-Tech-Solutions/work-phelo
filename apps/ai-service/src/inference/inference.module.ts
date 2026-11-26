import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INFERENCE_PROVIDER } from './inference-provider';
import { createInferenceProvider } from './provider.factory';
import { MockExecutionConfig } from './mock.provider';

@Module({
  providers: [
    {
      provide: INFERENCE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createInferenceProvider({
          NODE_ENV: config.getOrThrow<MockExecutionConfig['NODE_ENV']>('NODE_ENV'),
          AI_PROVIDER: config.getOrThrow<'mock'>('AI_PROVIDER'),
          AI_ENABLED: config.getOrThrow<boolean>('AI_ENABLED'),
          AI_MOCK_ENABLED: config.getOrThrow<boolean>('AI_MOCK_ENABLED'),
          AI_INTERNAL_DEMO_ENABLED: config.get<boolean>('AI_INTERNAL_DEMO_ENABLED'),
          AI_RUNTIME_SCOPE: config.get<string>('AI_RUNTIME_SCOPE'),
          AI_REQUEST_TIMEOUT_MS: config.getOrThrow<number>('AI_REQUEST_TIMEOUT_MS'),
        }),
    },
  ],
  exports: [INFERENCE_PROVIDER],
})
export class InferenceModule {}

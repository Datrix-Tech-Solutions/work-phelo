import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { parseRuntimeEnv } from './config/runtime-env';
import { InferenceModule } from './inference/inference.module';
import { HealthModule } from './health/health.module';
import { FoundationOnlyGuard } from './security/foundation-only.guard';
import { TrustedAuthModule } from './auth/trusted-auth.module';
import { EligibilityController } from './eligibility/eligibility.controller';

export interface ConfigurationOptions {
  envFilePath?: string;
  ignoreEnvFile?: boolean;
}

@Module({})
export class AppModule {
  static register(options: ConfigurationOptions = {}): DynamicModule {
    return {
      module: AppModule,
      controllers: [EligibilityController],
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ...options,
          // ConfigModule loads the env file before passing values to validation.
          validate: parseRuntimeEnv,
        }),
        InferenceModule,
        HealthModule,
        TrustedAuthModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: FoundationOnlyGuard }],
    };
  }
}

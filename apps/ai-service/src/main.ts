import 'reflect-metadata';
import { ConsoleLogger, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Server } from 'http';
import { AppModule, ConfigurationOptions } from './app.module';
import { configureApplication } from './app.setup';
import { RuntimeConfigurationError } from './config/runtime-env';
import { HttpLogSink } from './common/request-logging';

export async function createApplication(
  options: ConfigurationOptions = {},
  log?: HttpLogSink,
): Promise<INestApplication<Server>> {
  const app = await NestFactory.create<INestApplication<Server>>(AppModule.register(options), {
    bodyParser: false,
    abortOnError: false,
    logger: false,
  });
  configureApplication(app, log);
  return app;
}

export function startupErrorMessage(error: unknown): string {
  return error instanceof RuntimeConfigurationError
    ? error.message
    : 'AI service startup failed; check runtime configuration and port availability';
}

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  try {
    const port = app.get(ConfigService).getOrThrow<number>('AI_SERVICE_PORT');
    await app.listen(port);
    new ConsoleLogger('Bootstrap').log(
      `AI service foundation listening on port ${port}; inference unavailable`,
    );
  } catch (error) {
    await app.close();
    throw error;
  }
}

if (require.main === module) {
  void bootstrap().catch((error: unknown) => {
    new ConsoleLogger('Bootstrap').error(startupErrorMessage(error));
    process.exitCode = 1;
  });
}

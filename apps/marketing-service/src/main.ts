import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import cookieParser from 'cookie-parser';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import { assertMarketingRuntimeEnv } from './config/runtime-env';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  assertMarketingRuntimeEnv();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Service-to-service routes are called by their bare path, not under /api.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'internal/accounting-events', method: RequestMethod.POST },
    ],
  });
  if (isSwaggerEnabled()) {
    setupSwagger(app);
  }
  const port = process.env.PORT || 4006;
  await app.listen(port);
  console.log(`Marketing service running on port ${port}`);

  const rabbitMqUrl = process.env.RABBITMQ_URL;
  if (rabbitMqUrl) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitMqUrl],
        queue: 'marketing_queue',
        queueOptions: {
          durable: true,
          arguments: {
            'x-message-ttl': 3600000,
          },
        },
        noAck: false,
        prefetchCount: 10,
      },
    });
    app.startAllMicroservices().catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Marketing RabbitMQ microservice failed to start:', detail);
    });
  }
}

void bootstrap();

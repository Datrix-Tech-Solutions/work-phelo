import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import { assertInventoryRuntimeEnv, inventoryServicePort } from './config/runtime-env';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  assertInventoryRuntimeEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApplication(app);
  if (isSwaggerEnabled()) setupSwagger(app);
  const port = inventoryServicePort();
  await app.listen(port);
  new Logger('Bootstrap').log('Inventory service listening on port ' + port);
}

void bootstrap();

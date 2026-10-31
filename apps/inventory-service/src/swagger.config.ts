import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo Inventory Operations')
    .setDescription(
      'Platform scaffold only. Business APIs and domain models await approved Jira user stories.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    useGlobalPrefix: true,
  });
}

import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — Notification Service')
    .setDescription(
      '## Notification API\n\n' +
        'Handles notification delivery, event subscriptions, and RabbitMQ message routing.\n\n' +
        '### Base URL\n' +
        'All HTTP requests are served under the global prefix /api.\n\n' +
        '**Example:** GET http://157.245.220.205/api/v1/hr/notifications\n\n' +
        '### Microservice\n' +
        'This service also connects to RabbitMQ using the queue notification_queue.\n\n' +
        '### Authentication\n' +
        'Protected endpoints require a valid JWT token via:\n' +
        '- **Bearer token**: Authorization: Bearer <token>\n' +
        '- **Cookie**: access_token\n\n' +
        '### Swagger Docs\n' +
        'Use the docs page to review available notification endpoints and test request bodies.',
    )
    .setVersion('1.0')
    .addServer('http://157.245.220.205/api/v1', 'Dev Server')
    .addServer('http://localhost:8080/api/v1', 'Local Dev')
    .addTag('Notifications', 'Notification delivery and preferences')
    .addTag('Events', 'Event subscriptions and webhook routing')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
  });

  console.log('📖 Notification service docs: http://localhost:4004/docs');
}

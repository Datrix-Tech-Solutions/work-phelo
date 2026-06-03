import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — Subscription Service')
    .setDescription(
      '## Subscription API\n\n' +
        'Handles subscription plans, customer subscriptions, and billing cycles.\n\n' +
        '### Base URL\n' +
        'All requests are served under the global prefix /api.\n\n' +
        '**Example:** GET http://localhost:4005/api/subscriptions\n\n' +
        '### Authentication\n' +
        'Protected endpoints require a valid JWT token via:\n' +
        '- **Bearer token**: Authorization: Bearer <token>\n' +
        '- **Cookie**: access_token\n\n' +
        '### Swagger Docs\n' +
        'Use the docs page to explore available subscription endpoints and test request bodies.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:4005/api', 'Local Dev')
    .addTag('Subscriptions', 'Subscription management and plan lifecycle')
    .addTag('Billing', 'Billing and recurring charge operations')
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
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      url: 'docs-json',
    },
    customSiteTitle: 'WorkPhelo Subscription API Docs',
  });

  console.log('📖 Subscription service docs: http://localhost:4005/api/docs');
}

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo Reinsurance Operations API')
    .setDescription(
      `
Broker-only Reinsurance Operations endpoints owned by \`reinsurance-service\`.

### Routes
- Through the API Gateway: \`/api/v1/operations/reinsurance/*\`
- Direct local service access: \`/api/*\`

### Authentication
Protected requests use the HTTP-only \`access_token\` cookie set by Auth login.
Bearer authentication is also documented for API tooling. Through the gateway,
tenant context and signed dynamic permissions are forwarded to this service.

### Authorization
Counterparty endpoints require the tenant to have the \`operations\` module and
\`operations.reinsurance\` feature enabled, plus the endpoint-specific
\`operations.reinsurance.counterparties:*\` permission.

Documentation is exposed only when \`ENABLE_SWAGGER=true\`; the deployment
pipeline enables it for development only.
      `,
    )
    .setVersion('1.0')
    .addServer(
      '/api/v1/operations/reinsurance',
      'API Gateway (select when opening docs through the gateway)',
    )
    .addServer('/api', 'Direct reinsurance-service (local development)')
    .addTag('Health', 'Development and deployment health verification')
    .addTag('Access', 'Authenticated entitlement and permission verification')
    .addTag('Counterparties', 'Cedants, reinsurers and brokers')
    .addCookieAuth('access_token')
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
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: 'WorkPhelo Reinsurance API Docs',
  });
}

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
Counterparty, placement and email endpoints require the tenant to have the \`operations\` module and
\`operations.reinsurance\` feature enabled, plus the endpoint-specific
\`operations.reinsurance.counterparties:*\`, \`operations.reinsurance.settings:*\` or
\`operations.reinsurance.placements:*\`, \`operations.reinsurance.email:*\` or
\`operations.reinsurance.email-settings:*\` permission.

### Risk settings integration
New frontend work should use \`/settings/risk-classes\` for RiskClass CRUD and
\`/settings/risk-types\` for RiskType CRUD, fields and form schemas.

### Slip previews
Offer and closing slip preview endpoints are read-only. They return preview
payloads only and do not create PDFs, persist document records or send email.
Preview calculations intentionally use \`facultativeOffer ?? 0\` when the
facultative offer is not yet known.

Financial lock status is available on placement detail responses and
\`GET /placements/:id/lock-status\`. Lifecycle edit rules and financial locks
are distinct: \`CLOSED\` placements block direct edits but may reopen to
\`CLOSING\` when no financial lock exists. Payment/settlement activity will
hard-lock future direct mutations and require the future endorsement workflow,
while debit note issuance alone is not a hard lock in the MVP policy.

### Email foundation
The email endpoints are a technical foundation for embedded mailbox workflows:
connection metadata, provider verification, sync proof-of-concept, thread/message
metadata and manual placement links. They do not send/reply/forward email, download
attachments, parse content with AI or automatically update placements.

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
    .addTag('Placements', 'Facultative placement lifecycle foundation')
    .addTag('Risk Classes', 'Risk class settings and nested risk type lists')
    .addTag('Risk Types', 'Risk types, dynamic fields and form schemas')
    .addTag(
      'Email Mailboxes',
      'Mailbox connectivity, provider verification and metadata sync',
    )
    .addTag(
      'Email Threads',
      'Thread/message metadata and manual placement email links',
    )
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
      url: 'docs-json',
    },
    customSiteTitle: 'WorkPhelo Reinsurance API Docs',
  });
}

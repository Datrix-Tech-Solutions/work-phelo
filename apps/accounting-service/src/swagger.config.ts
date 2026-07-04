import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo Accounting API')
    .setDescription(
      `
Tenant-scoped Accounting ledger foundation.

### Routes
- API Gateway: \`/api/v1/accounting/*\`
- Direct local service: \`/api/*\`

### Ledger guarantees
- Draft journals must be balanced before creation and posting.
- Only open fiscal periods accept postings.
- Posted journals and lines are immutable.
- Corrections create exact linked reversal journals.
- Transaction and base-currency amounts are stored on every journal line.
- Source idempotency keys are tenant-scoped for future operational integrations.

AP/AR invoices, operational source-event posting and financial statements are
outside this foundation.
      `,
    )
    .setVersion('1.0')
    .addServer('/api/v1/accounting', 'API Gateway')
    .addServer('/api', 'Direct accounting-service')
    .addCookieAuth('access_token')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Accounting - Health')
    .addTag('Accounting - Configuration')
    .addTag('Accounting - Currencies')
    .addTag('Accounting - Fiscal Periods')
    .addTag('Accounting - Chart of Accounts')
    .addTag('Accounting - Cost Centres')
    .addTag('Accounting - Subledgers')
    .addTag('Accounting - Journals')
    .addTag('Accounting - General Ledger')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
  });
}

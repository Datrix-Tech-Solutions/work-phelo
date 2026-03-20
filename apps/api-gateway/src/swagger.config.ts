import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — API Gateway')
    .setDescription(
      `
## API Gateway — Single Entry Point

All frontend requests go through this gateway at port **4000**.

### URL Convention
\`/api/{service}/{path}\` → proxied to the service

### Service Routes
| Prefix | Service | Port |
|---|---|---|
| \`/api/auth/auth/*\` | Auth endpoints | 4001 |
| \`/api/auth/tenants/*\` | Tenant management | 4001 |
| \`/api/auth/users/*\` | User management | 4001 |
| \`/api/auth/company-roles/*\` | Company roles | 4001 |
| \`/api/auth/permissions/*\` | Permissions | 4001 |
| \`/api/hr/employees/*\` | Employees | 4002 |
| \`/api/hr/departments/*\` | Departments | 4002 |
| \`/api/hr/leave/*\` | Leave management | 4002 |
| \`/api/hr/time/*\` | Time tracking | 4002 |
| \`/api/hr/payroll/*\` | Payroll | 4002 |
| \`/api/hr/appraisals/*\` | Appraisals | 4002 |

### Public Endpoints (no auth required)
- \`POST /api/auth/auth/login\`
- \`POST /api/auth/auth/admin/login\`
- \`POST /api/auth/auth/refresh\`
- \`POST /api/auth/auth/verify-email\`
- \`POST /api/auth/auth/forgot-password\`
- \`POST /api/auth/auth/reset-password\`
- \`POST /api/auth/auth/force-reset-password\`
- \`POST /api/auth/tenants/register\`
- \`POST /api/auth/users/accept-invite\`

### Rate Limits
- 10 requests/second per IP
- 50 requests/10 seconds per IP
- 200 requests/minute per IP
    `,
    )
    .setVersion('1.0')
    .addTag('Gateway', 'Health and gateway endpoints')
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  console.log('📖 API Gateway docs: http://localhost:4000/docs');
}

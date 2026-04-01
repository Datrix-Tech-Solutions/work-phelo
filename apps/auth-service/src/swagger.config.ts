import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — Auth Service')
    .setDescription(
      `
## Authentication & Authorization API

Handles all authentication, user management, tenant management, and RBAC.

### Base URL
All requests go through the API Gateway at /api/v1/auth/...

**Example:** POST http://157.245.220.205/api/v1/auth/login

### Authentication
All protected endpoints require a valid JWT token either via:
- **Cookie**: \`access_token\` (set automatically on login)
- **Bearer token**: \`Authorization: Bearer <token>\`

### Token Refresh
Access tokens expire in **15 minutes**. Use \`POST /auth/refresh\` to rotate tokens using the \`refresh_token\` cookie.

### System Roles
| Role | Description |
|---|---|
| SUPER_ADMIN | Datrix platform owner — full platform access |
| TENANT_ADMIN | Company admin — full access within their company |
| EMPLOYEE | Regular user — access controlled by company role |

### Company Roles
Each tenant has 3 default company roles seeded automatically: **Company Admin**, **Manager**, **Employee**.
Tenant Admins can create custom roles with specific permissions.

### Demo Credentials
| Role | Slug | Email | Password |
|---|---|---|---|
| SuperAdmin | — | superadmin@datrix.com | SuperAdmin123! |
| Tenant Admin | acme-ghana | admin@acmeghana.com | Admin123! |
| Manager | acme-ghana | hr.manager@acmeghana.com | Manager123! |
| Employee | acme-ghana | kofi.boateng@acmeghana.com | Employee123! |
    `,
    )
    .setVersion('1.0')
    .addServer('http://157.245.220.205/api/v1', 'Dev Server (via API Gateway)')
    .addServer('http://localhost:8080/api/v1', 'Local Dev (via API Gateway)')
    .addTag('Auth', 'Login, logout, token refresh, MFA, social auth')
    .addTag('Tenants', 'Tenant registration and management')
    .addTag('Users', 'User management and invitations')
    .addTag('Company Roles', 'Company role management')
    .addTag('Permissions', 'Permission grants and revokes')
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
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });

  console.log('📖 Auth Service docs: http://localhost:4001/docs');
}

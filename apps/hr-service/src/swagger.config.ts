import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — HR Service')
    .setDescription(
      `
## Human Resources API

Handles all HR operations: employees, departments, leave, time tracking, payroll, and appraisals.

### Base URL
All requests go through the API Gateway at /api/v1/hr/...

**Example:** GET http://157.245.220.205/api/v1/hr/dashboard/summary

### Authentication
All endpoints require a valid JWT token via:
- **Cookie**: \`access_token\`
- **Bearer token**: \`Authorization: Bearer <token>\`

### Ghana Payroll Calculations
- **SSNIT**: 5.5% employee, 13% employer contribution
- **PAYE**: Ghana Revenue Authority 2024 tax bands
- All monetary values use Decimal precision (no floating point)

### Response Format
\`\`\`json
{
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
\`\`\`
    `,
    )
    .setVersion('1.0')
    .addServer(
      'http://157.245.220.205/api/v1/hr',
      'Dev Server (via API Gateway)',
    )
    .addServer('http://localhost:8080/api/v1/hr', 'Local Dev (via API Gateway)')
    .addTag('Departments', 'Department management')
    .addTag('Employees', 'Employee profiles and documents')
    .addTag('Leave', 'Leave types, balances, requests and approvals')
    .addTag('Time', 'Clock-in/out, timesheets, corrections, schedules')
    .addTag('Payroll', 'Payroll processing with Ghana GRA calculations')
    .addTag('Appraisals', 'Performance appraisal cycles and reviews')
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

  console.log('📖 HR Service docs: http://localhost:4002/docs');
}

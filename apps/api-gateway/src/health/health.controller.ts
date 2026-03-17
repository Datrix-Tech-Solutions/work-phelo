import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        auth: process.env.AUTH_SERVICE_URL,
        hr: process.env.HR_SERVICE_URL,
        notification: process.env.NOTIFICATION_SERVICE_URL,
        subscription: process.env.SUBSCRIPTION_SERVICE_URL,
        marketing: process.env.MARKETING_SERVICE_URL,
      },
    };
  }
}

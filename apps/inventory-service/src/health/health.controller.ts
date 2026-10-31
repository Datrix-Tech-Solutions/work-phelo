import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Inventory - Health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check Inventory scaffold process health (no database configured)' })
  @ApiOkResponse({ description: 'The Inventory HTTP scaffold is ready' })
  check() {
    return {
      status: 'ok',
      service: 'inventory-service',
      timestamp: new Date().toISOString(),
    };
  }
}

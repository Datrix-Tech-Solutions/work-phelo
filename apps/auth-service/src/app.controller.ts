import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Service liveness check' })
  @ApiResponse({ status: 200, description: 'Auth service is running' })
  getHello(): string {
    return this.appService.getHello();
  }
}

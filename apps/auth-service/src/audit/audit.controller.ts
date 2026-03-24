import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Audit Logs')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query audit logs — TENANT_ADMIN and SUPER_ADMIN only',
  })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: [
      'CREATE',
      'UPDATE',
      'DELETE',
      'APPROVE',
      'REVOKE',
      'LOGIN',
      'LOGOUT',
      'EXPORT',
      'ASSIGN',
      'RUN',
    ],
  })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  query(
    @Req() req: any,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.query(req.user.tenantId, {
      resource,
      userId,
      action,
      from,
      to,
      page,
      limit,
    });
  }
}

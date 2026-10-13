import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { InternalServiceAuthGuard } from '../auth/guards/internal-service-auth.guard';
import { QueryModuleUsersDto } from './dto/query-module-users.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('Internal Permissions')
@Controller('internal/tenants/:tenantId/module-users')
@UseGuards(InternalServiceAuthGuard)
export class PermissionsInternalController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the users who can use a module, for an internal service',
    description:
      'Service-authenticated. Same people as GET /permissions/module-users, without needing the caller to hold the permission-sets permission, so a service can offer them in a picker or validate a chosen user.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  async list(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: QueryModuleUsersDto,
  ) {
    const users = await this.permissions.getModuleUsers(tenantId, query.module);
    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      status: u.status,
    }));
  }
}

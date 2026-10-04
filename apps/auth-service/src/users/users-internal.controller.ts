import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InternalServiceAuthGuard } from '../auth/guards/internal-service-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const MAX_IDS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('Internal Users')
@Controller('internal/tenants/:tenantId/users')
@UseGuards(InternalServiceAuthGuard)
export class UsersInternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Names of specific users, for an internal service',
    description:
      'Service-authenticated. Returns the name of each requested user in the tenant, whether or not they hold any module permission, so a service can show who a record belongs to.',
  })
  @ApiParam({ name: 'tenantId', format: 'uuid' })
  @ApiQuery({
    name: 'ids',
    description: `Comma-separated user ids, at most ${MAX_IDS}.`,
  })
  async names(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('ids') ids = '',
  ) {
    const wanted = [
      ...new Set(
        ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    if (wanted.length > MAX_IDS || wanted.some((id) => !UUID.test(id))) {
      throw new BadRequestException(
        `ids must be at most ${MAX_IDS} comma-separated user ids`,
      );
    }
    if (wanted.length === 0) return [];

    return this.prisma.user.findMany({
      where: { tenantId, id: { in: wanted } },
      select: { id: true, firstName: true, lastName: true },
    });
  }
}

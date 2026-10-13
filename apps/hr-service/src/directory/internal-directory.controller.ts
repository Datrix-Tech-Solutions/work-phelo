import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '@work-phelo/internal-auth';
import { DriverLicenceService } from '../employees/driver-licence.service';
import { DirectoryService } from './directory.service';
import {
  InternalDriverLicenceCheckDto,
  InternalDirectoryQueryDto,
  InternalResolveDirectoryDto,
} from './dto/internal-directory.dto';

@ApiTags('Internal Employee Directory')
@Controller('internal/employee-directory')
@UseGuards(InternalServiceAuthGuard)
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
@ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
@ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
export class InternalDirectoryController {
  constructor(
    private readonly directory: DirectoryService,
    private readonly driverLicences: DriverLicenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active employees (id, name, department)' })
  @ApiOkResponse({ description: 'Employees.' })
  list(@Query() query: InternalDirectoryQueryDto) {
    return this.directory.list(query.tenantId);
  }

  @Post('resolve')
  @ApiOperation({
    summary: 'Resolve a user to their employee record and validate employees',
  })
  resolve(@Body() dto: InternalResolveDirectoryDto) {
    return this.directory.resolve(dto.tenantId, {
      userId: dto.userId,
      employeeIds: dto.employeeIds,
      userIds: dto.userIds,
    });
  }

  @Post('driver-licence')
  @ApiOperation({
    summary:
      "Whether a user may drive themselves: an unexpired driver's licence and its image on file",
  })
  driverLicence(@Body() dto: InternalDriverLicenceCheckDto) {
    return this.driverLicences.checkForUser(
      dto.tenantId,
      dto.userId,
      dto.onDate?.slice(0, 10),
    );
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  AddTransportOfficersDto,
  QueryTransportOfficersDto,
} from './dto/transport-officer.dto';
import { TransportOfficersService } from './transport-officers.service';

const {
  TRANSPORT_OFFICERS_VIEW,
  TRANSPORT_OFFICERS_CREATE,
  TRANSPORT_OFFICERS_EDIT,
} = MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

@Controller('transport-officers')
@ApiTags('Marketing - Transport Officers')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module or transport officer permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class TransportOfficersController {
  constructor(private readonly service: TransportOfficersService) {}

  @Get()
  @RequireAnyPermission(TRANSPORT_OFFICERS_VIEW)
  @ApiOperation({
    summary: 'List transport officers (drivers)',
    description: 'Officer details are read live from HR.',
  })
  list(
    @Query() query: QueryTransportOfficersDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.list(request.user, query);
  }

  @Get('candidates')
  @RequireAnyPermission(TRANSPORT_OFFICERS_CREATE)
  @ApiOperation({
    summary: 'Employees who can be added as transport officers',
    description: 'Active HR employees who are not already officers.',
  })
  candidates(@Req() request: AuthedRequest) {
    return this.service.candidates(request.user);
  }

  @Post()
  @RequireAnyPermission(TRANSPORT_OFFICERS_CREATE)
  @ApiOperation({
    summary: 'Add employees as transport officers',
    description: 'Re-adding a deactivated officer reactivates them.',
  })
  add(@Body() dto: AddTransportOfficersDto, @Req() request: AuthedRequest) {
    return this.service.add(request.user, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(TRANSPORT_OFFICERS_EDIT)
  @ApiOperation({
    summary: 'Deactivate a transport officer',
    description:
      'Removes them from driver dropdowns. Trips already approved with them are kept; the response reports how many are upcoming.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.setActive(request.user, id, false);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(TRANSPORT_OFFICERS_EDIT)
  @ApiOperation({ summary: 'Reactivate a transport officer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.setActive(request.user, id, true);
  }
}

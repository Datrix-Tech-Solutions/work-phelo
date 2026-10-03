import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  AllocationOptionsQueryDto,
  ApproveTransportRequestDto,
  CompleteTransportRequestDto,
  CreateTransportRequestDto,
  QueryTransportRequestsDto,
  RescheduleTransportRequestDto,
  ReviewTransportRequestDto,
  UpdateTransportRequestDto,
} from './dto/transport-request.dto';
import { RequestsService } from './requests.service';

const {
  REQUESTS_VIEW,
  REQUESTS_VIEW_ALL,
  REQUESTS_CREATE,
  REQUESTS_EDIT,
  REQUESTS_CANCEL,
  REQUESTS_APPROVE_ALL,
} = MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

@Controller('requests')
@ApiTags('Marketing - Transport Requests')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description:
    'Marketing module or transport request permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Get()
  @RequireAnyPermission(REQUESTS_VIEW, REQUESTS_VIEW_ALL)
  @ApiOperation({
    summary: 'List transport requests',
    description:
      'Users with marketing.requests:VIEW see the requests they raised. Users with marketing.requests.all:VIEW see every request in the tenant.',
  })
  list(
    @Query() query: QueryTransportRequestsDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.list(request.user, query);
  }

  @Get('form-options')
  @RequireAnyPermission(REQUESTS_CREATE, REQUESTS_EDIT)
  @ApiOperation({
    summary: 'Requester details and selectable passengers for the request form',
    description:
      'Served from HR so marketing users do not need HR access to fill the form.',
  })
  formOptions(@Req() request: AuthedRequest) {
    return this.service.formOptions(request.user);
  }

  @Get(':id/allocation-options')
  @RequireAnyPermission(REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Vehicles and drivers an approver can allocate',
    description:
      'Each is flagged unavailable when under maintenance, still out on an overdue trip, or allocated to an overlapping approved trip. Pass travelDate, departureTime and returnTime to check a new window when rescheduling.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  allocationOptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AllocationOptionsQueryDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.allocationOptions(request.user, id, query);
  }

  @Get(':id')
  @RequireAnyPermission(REQUESTS_VIEW, REQUESTS_VIEW_ALL)
  @ApiOperation({ summary: 'Get a transport request' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.findOne(request.user, id);
  }

  @Post()
  @RequireAnyPermission(REQUESTS_CREATE)
  @ApiOperation({
    summary: 'Raise a transport request',
    description:
      'The requester is the signed-in user, with their HR department. The request starts as PENDING.',
  })
  create(
    @Body() dto: CreateTransportRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.create(request.user, dto);
  }

  @Patch(':id')
  @RequireAnyPermission(REQUESTS_EDIT)
  @ApiOperation({ summary: 'Edit your own request while it is still pending' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransportRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(REQUESTS_CANCEL, REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Cancel a pending or approved (including on-route) request',
    description:
      'The requester can cancel their own; anyone who can approve can cancel any. A completed trip cannot be cancelled.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.cancel(request.user, id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(REQUESTS_EDIT, REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Complete a trip once its return time has passed',
    description:
      'Records when the vehicle actually got back. The requester can complete their own; anyone who can approve can complete any. Final: a completed trip cannot be changed.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTransportRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.complete(request.user, id, dto);
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary:
      'Reschedule an approved trip and re-allocate its vehicle and driver',
    description:
      'Like approving, with a new date and times. Runs the same availability checks and keeps the previous schedule.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleTransportRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.reschedule(request.user, id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Approve a pending request and allocate a vehicle and driver',
    description:
      'Both a vehicle and a driver are required. A vehicle or driver already allocated to an overlapping approved trip is rejected.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveTransportRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.approve(request.user, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(REQUESTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Reject a pending request',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewTransportRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.reject(request.user, id, dto);
  }
}

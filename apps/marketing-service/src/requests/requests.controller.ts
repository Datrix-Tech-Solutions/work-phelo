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
  DestinationOptionsQueryDto,
  QueryTransportRequestsDto,
  RescheduleTransportRequestDto,
  ReviewTransportRequestDto,
  StartTransportRequestDto,
  UpdateTransportRequestDto,
} from './dto/transport-request.dto';
import { RequestsService } from './requests.service';

const { REQUESTS_APPROVE_ALL } = MarketingCrmSettingsPermission;

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
  // Open to everyone, like appointments: the service limits it to the caller's own requests (and
  // lets approvers act on any).
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
  // Open to everyone, like appointments: the service limits it to the caller's own requests (and
  // lets approvers act on any).
  @ApiOperation({
    summary: 'Requester details and selectable passengers for the request form',
    description:
      'Served from HR so marketing users do not need HR access to fill the form.',
  })
  formOptions(@Req() request: AuthedRequest) {
    return this.service.formOptions(request.user);
  }

  @Get('destination-options')
  // Open to everyone, like the rest of the request form: the service limits it to the clients and
  // prospects the caller could already see (their own, or all with view-all access).
  @ApiOperation({
    summary: 'Clients and prospects to choose as trip destinations',
    description:
      'Search by company name. Only the clients and prospects the caller can already see are returned, each with its location.',
  })
  destinationOptions(
    @Query() query: DestinationOptionsQueryDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.destinationOptions(request.user, query);
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
  // Open to everyone, like appointments: the service limits it to the caller's own requests (and
  // lets approvers act on any).
  @ApiOperation({ summary: 'Get a transport request' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.findOne(request.user, id);
  }

  @Post()
  // Open to everyone, like appointments: the service limits it to the caller's own requests (and
  // lets approvers act on any).
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
  // Open to everyone, like appointments: the service limits it to the caller's own requests (and
  // lets approvers act on any).
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
  // Open to everyone, like appointments: the service limits it to the caller's own requests (and
  // lets approvers act on any).
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

  @Get(':id/start-options')
  @ApiOperation({
    summary: 'Starting mileage and vehicle condition to prefill the start form',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  startOptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.startOptions(request.user, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  // Open to everyone, like complete: the service limits it to the caller's own requests (and
  // lets approvers act on any).
  @ApiOperation({
    summary: 'Start an approved trip',
    description:
      'Puts the trip on route and records the starting mileage, vehicle condition, actual departure time and notes. The requester can start their own; anyone who can approve can start any.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartTransportRequestDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.start(request.user, id, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  // Open to everyone, like appointments: the service limits it to the caller's own requests (and
  // lets approvers act on any).
  @ApiOperation({
    summary:
      'Complete a started trip once its return time has passed (or straight away, if it had none)',
    description:
      'Records when the vehicle actually got back and any further places visited. The requester can complete their own; anyone who can approve can complete any. Final: a completed trip cannot be changed.',
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

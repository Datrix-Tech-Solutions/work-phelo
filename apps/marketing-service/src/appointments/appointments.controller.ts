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
import { AppointmentsService } from './appointments.service';
import {
  AppointmentFormOptionsQueryDto,
  ApproveAppointmentDto,
  CreateAppointmentDto,
  QueryAppointmentsDto,
  ReviewAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

const { APPOINTMENTS_APPROVE_ALL } = MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

/**
 * Booking, viewing, editing and cancelling your own appointments needs marketing module access
 * and nothing more. The service widens what a caller can see or do when they hold
 * marketing.appointments.all:VIEW / :CREATE / :APPROVE.
 */
@Controller('appointments')
@ApiTags('Marketing - Appointments')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module or appointment permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List appointments',
    description:
      'Callers see appointments where they are the marketer or the assigned manager. marketing.appointments.all:VIEW (or APPROVE) sees every appointment in the tenant. Filter by date range with from/to; limit caps the result.',
  })
  list(@Query() query: QueryAppointmentsDto, @Req() request: AuthedRequest) {
    return this.service.list(request.user, query);
  }

  @Get('form-options')
  @ApiOperation({
    summary: 'Marketers, managers and prospects the appointment form may offer',
    description:
      'Without marketing.appointments.all:CREATE the only marketer is the caller, with their assigned prospects. With it, every marketing user is offered and the prospects are those of the chosen marketerUserId. Managers are listed to approvers only.',
  })
  formOptions(
    @Query() query: AppointmentFormOptionsQueryDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.formOptions(request.user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.findOne(request.user, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Book an appointment',
    description:
      'Starts as PENDING. The marketer is the caller; naming another marketer needs marketing.appointments.all:CREATE. The prospect must be assigned to the marketer.',
  })
  create(@Body() dto: CreateAppointmentDto, @Req() request: AuthedRequest) {
    return this.service.create(request.user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a pending appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.update(request.user, id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(APPOINTMENTS_APPROVE_ALL)
  @ApiOperation({
    summary: 'Approve a pending appointment, optionally assigning a manager',
    description:
      'A manager already approved for an overlapping appointment that day is rejected.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveAppointmentDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.approve(request.user, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(APPOINTMENTS_APPROVE_ALL)
  @ApiOperation({ summary: 'Reject a pending appointment' })
  @ApiParam({ name: 'id', format: 'uuid' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAppointmentDto,
    @Req() request: AuthedRequest,
  ) {
    return this.service.reject(request.user, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a pending or approved appointment',
    description: 'The marketer can cancel their own; approvers can cancel any.',
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
  @ApiOperation({
    summary: 'Mark an approved appointment as held',
    description:
      'The marketer, the assigned manager or an approver. Final: a completed appointment cannot change.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthedRequest,
  ) {
    return this.service.complete(request.user, id);
  }
}

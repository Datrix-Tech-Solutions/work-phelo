import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TimeService } from './time.service';
import { ClockInDto } from './dto/clock-in.dto';
import { TimeCorrectionDto } from './dto/time-correction.dto';
import { ReviewCorrectionDto } from './dto/review-correction.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateShiftSwapDto } from './dto/create-shift-swap.dto';
import { RespondShiftSwapDto } from './dto/respond-shift-swap.dto';
import { ReviewShiftSwapDto } from './dto/review-shift-swap.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { QueryEligibleSwapColleaguesDto } from './dto/query-eligible-swap-colleagues.dto';
import { QueryManagerShiftSwapsDto } from './dto/query-manager-shift-swaps.dto';
import { QuerySchedulesDto } from './dto/query-schedules.dto';
import { QueryTimeCorrectionsDto } from './dto/query-time-corrections.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Time')
@Controller('time')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'time')
@ApiBearerAuth('access-token')
export class TimeController {
  constructor(private readonly timeService: TimeService) {}

  @Post('clock-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CLOCK_IN_OUT)
  @ApiOperation({ summary: 'Clock in for the day' })
  @ApiBody({ type: ClockInDto })
  @ApiResponse({ status: 200, description: 'Clocked in successfully' })
  @ApiResponse({ status: 409, description: 'Already clocked in today' })
  clockIn(@Body() dto: ClockInDto, @Req() req: AuthenticatedRequest) {
    return this.timeService.clockIn(
      req.user.tenantId,
      req.user.id,
      dto,
      req.ip,
    );
  }

  @Post('clock-out')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CLOCK_IN_OUT)
  @ApiOperation({ summary: 'Clock out for the day' })
  @ApiResponse({ status: 200, description: 'Clocked out successfully' })
  @ApiResponse({ status: 400, description: 'Not clocked in today' })
  clockOut(@Req() req: AuthenticatedRequest) {
    return this.timeService.clockOut(req.user.tenantId, req.user.id);
  }

  @Get('today')
  @RequirePermissions(Permission.CLOCK_IN_OUT)
  @ApiOperation({
    summary: "Get today's clock status for the logged-in employee",
  })
  @ApiResponse({ status: 200, description: "Today's clock status retrieved" })
  getTodayStatus(@Req() req: AuthenticatedRequest) {
    return this.timeService.getTodayStatus(req.user.tenantId, req.user.id);
  }

  @Get('my-history')
  @RequirePermissions(Permission.CLOCK_IN_OUT)
  @ApiOperation({ summary: "Get current employee's own attendance history" })
  @ApiResponse({ status: 200, description: 'My attendance records' })
  getMyAttendance(@Req() req: AuthenticatedRequest) {
    return this.timeService.getMyAttendance(req.user.tenantId, req.user.id);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Get attendance records with date range filter' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['CLOCKED_IN', 'CLOCKED_OUT'],
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({
    name: 'mine',
    required: false,
    description: 'Filter to current user only',
  })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved' })
  async getAttendance(
    @Query() query: QueryAttendanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.getAttendance(
      req.user.tenantId,
      req.user as RequestUser,
      {
        employeeId: query.employeeId,
        from: query.from,
        to: query.to,
        departmentId: query.departmentId,
        status: query.status,
        search: query.search,
        page: query.page,
        mine: query.mine ?? false,
      },
    );
  }

  @Post('corrections')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SUBMIT_TIME_CORRECTION)
  @ApiOperation({ summary: 'Submit a time correction request' })
  @ApiBody({ type: TimeCorrectionDto })
  @ApiResponse({ status: 201, description: 'Time correction submitted' })
  submitCorrection(
    @Body() dto: TimeCorrectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.submitTimeCorrection(
      req.user.tenantId,
      req.user.id,
      dto,
    );
  }

  @Get('corrections')
  @ApiOperation({ summary: 'List time correction requests' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
  })
  @ApiResponse({ status: 200, description: 'Corrections retrieved' })
  getCorrections(
    @Query() query: QueryTimeCorrectionsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.getTimeCorrections(
      req.user.tenantId,
      req.user as RequestUser,
      query,
    );
  }

  @Patch('corrections/:id/review')
  @RequirePermissions(Permission.APPROVE_TIME_CORRECTION)
  @ApiOperation({ summary: 'Approve or reject a time correction' })
  @ApiParam({ name: 'id', description: 'Time correction UUID' })
  @ApiBody({ type: ReviewCorrectionDto })
  @ApiResponse({ status: 200, description: 'Correction reviewed' })
  reviewCorrection(
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.reviewTimeCorrection(
      req.user.tenantId,
      id,
      req.user as RequestUser,
      dto,
    );
  }

  @Get('live')
  @ApiOperation({ summary: 'Get all employees currently clocked in' })
  @ApiResponse({ status: 200, description: 'Live attendance list' })
  getLiveAttendance(@Req() req: AuthenticatedRequest) {
    return this.timeService.getLiveAttendance(
      req.user.tenantId,
      req.user as RequestUser,
    );
  }

  @Get('stats/today')
  @ApiOperation({ summary: "Get today's attendance stats" })
  @ApiResponse({ status: 200, description: 'Attendance stats' })
  getAttendanceStats(@Req() req: AuthenticatedRequest) {
    return this.timeService.getAttendanceStats(
      req.user.tenantId,
      req.user as RequestUser,
    );
  }

  @Post('schedules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shift schedule for an employee' })
  @ApiBody({ type: CreateScheduleDto })
  @ApiResponse({ status: 201, description: 'Schedule created' })
  createSchedule(
    @Body() dto: CreateScheduleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.createSchedule(
      req.user.tenantId,
      req.user as RequestUser,
      dto,
    );
  }

  @Get('schedules')
  @ApiOperation({ summary: 'Get shift schedules' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiResponse({ status: 200, description: 'Schedules retrieved' })
  getSchedules(
    @Query() query: QuerySchedulesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.getSchedules(
      req.user.tenantId,
      req.user as RequestUser,
      query.employeeId,
    );
  }

  @Patch('schedules/:id')
  @ApiOperation({ summary: 'Update a shift schedule' })
  @ApiParam({ name: 'id', description: 'Shift schedule UUID' })
  @ApiBody({ type: UpdateScheduleDto })
  @ApiResponse({ status: 200, description: 'Schedule updated' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.updateSchedule(
      req.user.tenantId,
      id,
      req.user as RequestUser,
      dto,
    );
  }

  @Delete('schedules/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a shift schedule' })
  @ApiParam({ name: 'id', description: 'Shift schedule UUID' })
  @ApiResponse({ status: 200, description: 'Schedule deleted' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  deleteSchedule(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.timeService.deleteSchedule(
      req.user.tenantId,
      id,
      req.user as RequestUser,
    );
  }

  @Get('shift-swaps/eligible-colleagues')
  @ApiOperation({
    summary: 'Get eligible colleague shift options for a swap request',
  })
  @ApiQuery({ name: 'scheduleId', required: true })
  @ApiQuery({
    name: 'shiftDate',
    required: true,
    description: 'ISO date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Optional colleague name search',
  })
  @ApiResponse({
    status: 200,
    description: 'Eligible colleague shift options retrieved',
  })
  getEligibleSwapColleagues(
    @Query() query: QueryEligibleSwapColleaguesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.getEligibleShiftSwapColleagues(
      req.user.tenantId,
      req.user as RequestUser,
      query,
    );
  }

  @Post('shift-swaps')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shift swap request' })
  @ApiBody({ type: CreateShiftSwapDto })
  @ApiResponse({ status: 201, description: 'Shift swap request created' })
  createShiftSwap(
    @Body() dto: CreateShiftSwapDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.createShiftSwapRequest(
      req.user.tenantId,
      req.user as RequestUser,
      dto,
    );
  }

  @Get('shift-swaps/my')
  @ApiOperation({
    summary: 'List shift swap requests relevant to the current employee',
  })
  @ApiResponse({ status: 200, description: 'Shift swap requests retrieved' })
  getMyShiftSwaps(@Req() req: AuthenticatedRequest) {
    return this.timeService.getMyShiftSwapRequests(
      req.user.tenantId,
      req.user as RequestUser,
    );
  }

  @Get('shift-swaps/pending-manager')
  @ApiOperation({
    summary:
      'List shift swap requests for the current approver or tenant admin',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Optional shift swap status filter',
  })
  @ApiResponse({
    status: 200,
    description: 'Approver shift swaps retrieved',
  })
  getPendingManagerShiftSwaps(
    @Query() query: QueryManagerShiftSwapsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.getPendingManagerShiftSwaps(
      req.user.tenantId,
      req.user as RequestUser,
      query.status,
    );
  }

  @Get('shift-swaps/:id')
  @ApiOperation({ summary: 'Get a single shift swap request' })
  @ApiParam({ name: 'id', description: 'Shift swap request UUID' })
  @ApiResponse({ status: 200, description: 'Shift swap request retrieved' })
  getShiftSwap(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.timeService.getShiftSwapRequest(
      req.user.tenantId,
      req.user as RequestUser,
      id,
    );
  }

  @Post('shift-swaps/:id/respond')
  @ApiOperation({
    summary: 'Accept or decline a shift swap request as the colleague',
  })
  @ApiParam({ name: 'id', description: 'Shift swap request UUID' })
  @ApiBody({ type: RespondShiftSwapDto })
  @ApiResponse({ status: 200, description: 'Shift swap request responded to' })
  respondToShiftSwap(
    @Param('id') id: string,
    @Body() dto: RespondShiftSwapDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.respondToShiftSwap(
      req.user.tenantId,
      req.user as RequestUser,
      id,
      dto,
    );
  }

  @Post('shift-swaps/:id/manager-decision')
  @ApiOperation({
    summary: 'Approve or reject a shift swap request as an approver',
  })
  @ApiParam({ name: 'id', description: 'Shift swap request UUID' })
  @ApiBody({ type: ReviewShiftSwapDto })
  @ApiResponse({
    status: 200,
    description: 'Shift swap request reviewed by approver',
  })
  reviewShiftSwap(
    @Param('id') id: string,
    @Body() dto: ReviewShiftSwapDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.reviewShiftSwap(
      req.user.tenantId,
      req.user as RequestUser,
      id,
      dto,
    );
  }

  @Get('my-schedule')
  @RequirePermissions(Permission.CLOCK_IN_OUT)
  @ApiOperation({
    summary:
      "Get employee's own schedule with leave blocks and public holidays",
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'ISO date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'ISO date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Schedule retrieved' })
  getMySchedule(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeService.getMySchedule(
      req.user.tenantId,
      req.user as RequestUser,
      { from, to },
    );
  }
}

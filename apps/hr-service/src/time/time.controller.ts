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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';

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
  clockIn(@Body() dto: ClockInDto, @Req() req: any) {
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
  clockOut(@Req() req: any) {
    return this.timeService.clockOut(req.user.tenantId, req.user.id);
  }

  @Get('today')
  @RequirePermissions(Permission.CLOCK_IN_OUT)
  @ApiOperation({
    summary: "Get today's clock status for the logged-in employee",
  })
  @ApiResponse({ status: 200, description: "Today's clock status retrieved" })
  getTodayStatus(@Req() req: any) {
    return this.timeService.getTodayStatus(req.user.tenantId, req.user.id);
  }

  @Get('my-history')
  @RequirePermissions(Permission.CLOCK_IN_OUT)
  @ApiOperation({ summary: "Get current employee's own attendance history" })
  @ApiResponse({ status: 200, description: 'My attendance records' })
  getMyAttendance(@Req() req: any) {
    return this.timeService.getMyAttendance(req.user.tenantId, req.user.id);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Get attendance records with date range filter' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({
    name: 'mine',
    required: false,
    description: 'Filter to current user only',
  })
  @ApiResponse({ status: 200, description: 'Attendance records retrieved' })
  async getAttendance(
    @Query('employeeId') employeeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('mine') mine: string,
    @Req() req: any,
  ) {
    return this.timeService.getAttendance(
      req.user.tenantId,
      req.user as RequestUser,
      {
        employeeId,
        from,
        to,
        mine: mine === 'true',
      },
    );
  }

  @Post('corrections')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SUBMIT_TIME_CORRECTION)
  @ApiOperation({ summary: 'Submit a time correction request' })
  @ApiBody({ type: TimeCorrectionDto })
  @ApiResponse({ status: 201, description: 'Time correction submitted' })
  submitCorrection(@Body() dto: TimeCorrectionDto, @Req() req: any) {
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
  getCorrections(@Query('status') status: string, @Req() req: any) {
    return this.timeService.getTimeCorrections(
      req.user.tenantId,
      req.user as RequestUser,
      { status },
    );
  }

  @Patch('corrections/:id/review')
  @RequirePermissions(Permission.APPROVE_TEAM_TIME)
  @ApiOperation({ summary: 'Approve or reject a time correction' })
  @ApiParam({ name: 'id', description: 'Time correction UUID' })
  @ApiBody({ type: ReviewCorrectionDto })
  @ApiResponse({ status: 200, description: 'Correction reviewed' })
  reviewCorrection(
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @Req() req: any,
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
  getLiveAttendance(@Req() req: any) {
    return this.timeService.getLiveAttendance(
      req.user.tenantId,
      req.user as RequestUser,
    );
  }

  @Get('stats/today')
  @ApiOperation({ summary: "Get today's attendance stats" })
  @ApiResponse({ status: 200, description: 'Attendance stats' })
  getAttendanceStats(@Req() req: any) {
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
  createSchedule(@Body() dto: CreateScheduleDto, @Req() req: any) {
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
  getSchedules(@Query('employeeId') employeeId: string, @Req() req: any) {
    return this.timeService.getSchedules(
      req.user.tenantId,
      req.user as RequestUser,
      employeeId,
    );
  }
}

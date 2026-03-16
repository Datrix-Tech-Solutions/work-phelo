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

@Controller('time')
@UseGuards(JwtAuthGuard)
export class TimeController {
  constructor(private readonly timeService: TimeService) {}

  @Post('clock-in')
  @HttpCode(HttpStatus.OK)
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
  clockOut(@Req() req: any) {
    return this.timeService.clockOut(req.user.tenantId, req.user.id);
  }

  @Get('today')
  getTodayStatus(@Req() req: any) {
    return this.timeService.getTodayStatus(req.user.tenantId, req.user.id);
  }

  @Get('attendance')
  getAttendance(
    @Query('employeeId') employeeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    return this.timeService.getAttendance(req.user.tenantId, {
      employeeId,
      from,
      to,
    });
  }

  @Post('corrections')
  @HttpCode(HttpStatus.CREATED)
  submitCorrection(@Body() dto: TimeCorrectionDto, @Req() req: any) {
    return this.timeService.submitTimeCorrection(
      req.user.tenantId,
      req.user.id,
      dto,
    );
  }

  @Get('corrections')
  getCorrections(@Query('status') status: string, @Req() req: any) {
    return this.timeService.getTimeCorrections(req.user.tenantId, { status });
  }

  @Patch('corrections/:id/review')
  reviewCorrection(
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @Req() req: any,
  ) {
    return this.timeService.reviewTimeCorrection(
      req.user.tenantId,
      id,
      req.user.id,
      dto,
    );
  }

  @Post('schedules')
  @HttpCode(HttpStatus.CREATED)
  createSchedule(@Body() dto: CreateScheduleDto, @Req() req: any) {
    return this.timeService.createSchedule(req.user.tenantId, req.user.id, dto);
  }

  @Get('schedules')
  getSchedules(@Query('employeeId') employeeId: string, @Req() req: any) {
    return this.timeService.getSchedules(req.user.tenantId, employeeId);
  }
}

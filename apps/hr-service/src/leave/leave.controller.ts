import { ApiTags } from '@nestjs/swagger';
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
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('uleave')
@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post('types')
  createLeaveType(@Body() dto: CreateLeaveTypeDto, @Req() req: any) {
    return this.leaveService.createLeaveType(req.user.tenantId, dto);
  }

  @Get('types')
  getLeaveTypes(@Req() req: any) {
    return this.leaveService.getLeaveTypes(req.user.tenantId);
  }

  @Get('balances/:employeeId')
  getBalances(@Param('employeeId') employeeId: string, @Req() req: any) {
    return this.leaveService.getLeaveBalances(req.user.tenantId, employeeId);
  }

  @Get('balances/me')
  getMyBalances(@Req() req: any) {
    return this.leaveService.getLeaveBalances(req.user.tenantId, req.user.id);
  }

  @Post('balances/:employeeId/initialize')
  initializeBalances(@Param('employeeId') employeeId: string, @Req() req: any) {
    return this.leaveService.initializeLeaveBalances(
      req.user.tenantId,
      employeeId,
    );
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  createRequest(@Body() dto: CreateLeaveRequestDto, @Req() req: any) {
    return this.leaveService.createRequest(req.user.tenantId, req.user.id, dto);
  }

  @Get('requests')
  getRequests(@Query('status') status: string, @Req() req: any) {
    return this.leaveService.getRequests(req.user.tenantId, {
      status,
      managerId: req.user.role === 'HR_MANAGER' ? req.user.id : undefined,
    });
  }

  @Get('requests/all')
  getAllRequests(@Query('status') status: string, @Req() req: any) {
    return this.leaveService.getRequests(req.user.tenantId, { status });
  }

  @Get('requests/my')
  getMyRequests(@Req() req: any) {
    return this.leaveService.getRequests(req.user.tenantId, {
      employeeId: req.user.id,
    });
  }

  @Patch('requests/:id/review')
  reviewRequest(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @Req() req: any,
  ) {
    return this.leaveService.reviewRequest(
      req.user.tenantId,
      id,
      req.user.id,
      dto,
    );
  }

  @Patch('requests/:id/cancel')
  cancelRequest(@Param('id') id: string, @Req() req: any) {
    return this.leaveService.cancelRequest(req.user.tenantId, id, req.user.id);
  }
}

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
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { RequireModule } from '../auth/decorators/module.decorator';

@ApiTags('Leave')
@Controller('leave')
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Patch('types/:id')
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiParam({ name: 'id', description: 'Leave type UUID' })
  @ApiResponse({ status: 200, description: 'Leave type updated' })
  @ApiResponse({
    status: 200,
    description: 'Warning returned if existing requests found',
  })
  updateLeaveType(
    @Param('id') id: string,
    @Body() dto: Partial<CreateLeaveTypeDto>,
    @Req() req: any,
  ) {
    return this.leaveService.updateLeaveType(req.user.tenantId, id, dto);
  }

  @Delete('types/:id')
  @ApiOperation({
    summary: 'Delete a custom leave type — default types cannot be deleted',
  })
  @ApiParam({ name: 'id', description: 'Leave type UUID' })
  @ApiResponse({ status: 200, description: 'Leave type deleted' })
  @ApiResponse({
    status: 403,
    description: 'Default leave types cannot be deleted',
  })
  deleteLeaveType(@Param('id') id: string, @Req() req: any) {
    return this.leaveService.deleteLeaveType(req.user.tenantId, id);
  }

  @Post('public-holidays')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a public holiday' })
  @ApiBody({
    schema: { example: { name: 'Independence Day', date: '2026-03-06' } },
  })
  @ApiResponse({ status: 201, description: 'Public holiday added' })
  createPublicHoliday(
    @Body() dto: { name: string; date: string },
    @Req() req: any,
  ) {
    return this.leaveService.createPublicHoliday(req.user.tenantId, dto);
  }

  @Get('public-holidays')
  @ApiOperation({ summary: 'List all public holidays for the company' })
  @ApiResponse({ status: 200, description: 'Public holidays retrieved' })
  getPublicHolidays(@Req() req: any) {
    return this.leaveService.getPublicHolidays(req.user.tenantId);
  }

  @Patch('public-holidays/:id')
  @ApiOperation({ summary: 'Update a public holiday' })
  @ApiParam({ name: 'id', description: 'Public holiday UUID' })
  @ApiResponse({ status: 200, description: 'Public holiday updated' })
  updatePublicHoliday(
    @Param('id') id: string,
    @Body() dto: { name?: string; date?: string },
    @Req() req: any,
  ) {
    return this.leaveService.updatePublicHoliday(req.user.tenantId, id, dto);
  }

  @Delete('public-holidays/:id')
  @ApiOperation({ summary: 'Delete a public holiday' })
  @ApiParam({ name: 'id', description: 'Public holiday UUID' })
  @ApiResponse({ status: 200, description: 'Public holiday deleted' })
  deletePublicHoliday(@Param('id') id: string, @Req() req: any) {
    return this.leaveService.deletePublicHoliday(req.user.tenantId, id);
  }

  @Post('types')
  @ApiOperation({
    summary: 'Create a leave type (e.g. Annual, Sick, Maternity)',
  })
  @ApiBody({ type: CreateLeaveTypeDto })
  @ApiResponse({ status: 201, description: 'Leave type created' })
  createLeaveType(@Body() dto: CreateLeaveTypeDto, @Req() req: any) {
    return this.leaveService.createLeaveType(req.user.tenantId, dto);
  }

  @Get('types')
  @ApiOperation({ summary: 'List all leave types for the tenant' })
  @ApiResponse({ status: 200, description: 'Leave types retrieved' })
  getLeaveTypes(@Req() req: any) {
    return this.leaveService.getLeaveTypes(req.user.tenantId);
  }

  @Get('balances/:employeeId')
  @ApiOperation({ summary: 'Get leave balances for a specific employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 200, description: 'Leave balances retrieved' })
  getBalances(@Param('employeeId') employeeId: string, @Req() req: any) {
    return this.leaveService.getLeaveBalances(req.user.tenantId, employeeId);
  }

  @Get('balances/me')
  @ApiOperation({ summary: 'Get leave balances for the logged-in employee' })
  @ApiResponse({ status: 200, description: 'My leave balances retrieved' })
  getMyBalances(@Req() req: any) {
    return this.leaveService.getLeaveBalances(req.user.tenantId, req.user.id);
  }

  @Post('balances/:employeeId/initialize')
  @ApiOperation({ summary: 'Initialize leave balances for an employee' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  @ApiResponse({ status: 201, description: 'Leave balances initialized' })
  initializeBalances(@Param('employeeId') employeeId: string, @Req() req: any) {
    return this.leaveService.initializeLeaveBalances(
      req.user.tenantId,
      employeeId,
    );
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiBody({
    schema: {
      example: {
        name: 'Annual Leave',
        defaultDays: 21,
        isPaid: true,
        description: 'Yearly annual leave',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Leave request submitted' })
  @ApiResponse({ status: 400, description: 'Insufficient leave balance' })
  createRequest(@Body() dto: CreateLeaveRequestDto, @Req() req: any) {
    return this.leaveService.createRequest(req.user.tenantId, req.user.id, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get leave requests — scoped by role' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  })
  @ApiResponse({ status: 200, description: 'Leave requests retrieved' })
  getRequests(@Query('status') status: string, @Req() req: any) {
    return this.leaveService.getRequests(req.user.tenantId, {
      status,
      managerId: req.user.role === 'HR_MANAGER' ? req.user.id : undefined,
    });
  }

  @Get('requests/all')
  @ApiOperation({ summary: 'Get all leave requests — Admin only' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'All leave requests retrieved' })
  getAllRequests(@Query('status') status: string, @Req() req: any) {
    return this.leaveService.getRequests(req.user.tenantId, { status });
  }

  @Get('requests/my')
  @ApiOperation({ summary: "Get the logged-in employee's own leave requests" })
  @ApiResponse({ status: 200, description: 'My leave requests retrieved' })
  getMyRequests(@Req() req: any) {
    return this.leaveService.getRequests(req.user.tenantId, {
      employeeId: req.user.id,
    });
  }

  @Patch('requests/:id/review')
  @ApiOperation({ summary: 'Approve or reject a leave request' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiBody({ type: ReviewLeaveRequestDto })
  @ApiResponse({ status: 200, description: 'Leave request reviewed' })
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
  @ApiOperation({ summary: 'Cancel a leave request' })
  @ApiParam({ name: 'id', description: 'Leave request UUID' })
  @ApiResponse({ status: 200, description: 'Leave request cancelled' })
  cancelRequest(@Param('id') id: string, @Req() req: any) {
    return this.leaveService.cancelRequest(req.user.tenantId, id, req.user.id);
  }
}

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payroll')
@Controller('payroll')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Run payroll for a given period — Ghana GRA tax calculations applied',
  })
  @ApiBody({ type: RunPayrollDto })
  @ApiResponse({ status: 201, description: 'Payroll run created successfully' })
  @ApiResponse({ status: 400, description: 'No active employees found' })
  runPayroll(@Body() dto: RunPayrollDto, @Req() req: any) {
    return this.payrollService.runPayroll(req.user.tenantId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all payroll runs for the tenant' })
  @ApiResponse({ status: 200, description: 'Payroll runs retrieved' })
  getPayrollRuns(@Req() req: any) {
    return this.payrollService.getPayrollRuns(req.user.tenantId);
  }

  @Get('my-payslips')
  @ApiOperation({ summary: 'Get payslips for the logged-in employee' })
  @ApiResponse({ status: 200, description: 'Payslips retrieved' })
  getMyPayslips(@Req() req: any) {
    return this.payrollService.getMyPayslips(req.user.tenantId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific payroll run with all payslips' })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiResponse({ status: 200, description: 'Payroll run retrieved' })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  getPayrollRun(@Param('id') id: string, @Req() req: any) {
    return this.payrollService.getPayrollRunById(req.user.tenantId, id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a payroll run' })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiResponse({ status: 200, description: 'Payroll approved' })
  approvePayroll(@Param('id') id: string, @Req() req: any) {
    return this.payrollService.approvePayroll(
      req.user.tenantId,
      id,
      req.user.id,
    );
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Mark a payroll run as paid' })
  @ApiParam({ name: 'id', description: 'Payroll run UUID' })
  @ApiResponse({ status: 200, description: 'Payroll marked as paid' })
  markAsPaid(@Param('id') id: string, @Req() req: any) {
    return this.payrollService.markAsPaid(req.user.tenantId, id);
  }
}

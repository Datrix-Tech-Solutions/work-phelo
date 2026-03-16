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

@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  runPayroll(@Body() dto: RunPayrollDto, @Req() req: any) {
    return this.payrollService.runPayroll(req.user.tenantId, req.user.id, dto);
  }

  @Get()
  getPayrollRuns(@Req() req: any) {
    return this.payrollService.getPayrollRuns(req.user.tenantId);
  }

  @Get('my-payslips')
  getMyPayslips(@Req() req: any) {
    return this.payrollService.getMyPayslips(req.user.tenantId, req.user.id);
  }

  @Get(':id')
  getPayrollRun(@Param('id') id: string, @Req() req: any) {
    return this.payrollService.getPayrollRunById(req.user.tenantId, id);
  }

  @Patch(':id/approve')
  approvePayroll(@Param('id') id: string, @Req() req: any) {
    return this.payrollService.approvePayroll(
      req.user.tenantId,
      id,
      req.user.id,
    );
  }

  @Patch(':id/mark-paid')
  markAsPaid(@Param('id') id: string, @Req() req: any) {
    return this.payrollService.markAsPaid(req.user.tenantId, id);
  }
}

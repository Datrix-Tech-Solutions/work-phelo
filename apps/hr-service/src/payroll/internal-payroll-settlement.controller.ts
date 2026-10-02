import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '@work-phelo/internal-auth';
import { PayrollSettlementDto } from './dto/payroll-settlement.dto';
import { PayrollService } from './payroll.service';

@ApiTags('Internal Payroll Settlement')
@Controller('internal/payroll-settlement')
@UseGuards(InternalServiceAuthGuard)
export class InternalPayrollSettlementController {
  constructor(private readonly service: PayrollService) {}

  @Post(':payrollRunId/net-pay-settled')
  @ApiOperation({
    summary:
      "Release a payroll run's payslips once its Net Pay liability is fully paid",
    description:
      'Idempotent per payrollRunId — a repeat call after payslips are already released is a no-op.',
  })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
  @ApiOkResponse({ description: 'Payslips released (or already were).' })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  netPaySettled(
    @Param('payrollRunId', ParseUUIDPipe) payrollRunId: string,
    @Body() dto: PayrollSettlementDto,
  ) {
    return this.service.releasePayslipsForSettlement(
      dto.tenantId,
      payrollRunId,
    );
  }

  @Post(':payrollRunId/fully-settled')
  @ApiOperation({
    summary:
      'Mark a payroll run as PAID once every one of its liabilities is fully settled',
    description:
      'Idempotent per payrollRunId — a repeat call after the run is already PAID is a no-op.',
  })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
  @ApiOkResponse({ description: 'Payroll run marked PAID (or already was).' })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  fullySettled(
    @Param('payrollRunId', ParseUUIDPipe) payrollRunId: string,
    @Body() dto: PayrollSettlementDto,
  ) {
    return this.service.markFullySettledByAccounting(
      dto.tenantId,
      payrollRunId,
    );
  }
}

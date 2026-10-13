import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PayrollRunsService } from './payroll-runs.service';
import {
  ApprovePayrollMonthDto,
  RunConfiguredPayrollDto,
} from './dto/run-configured-payroll.dto';

type AuthedRequest = Request & { user: RequestUser };

// Own prefix: the payroll controller's `payroll/:id` would swallow `payroll/runs`.
@ApiTags('Payroll runs')
@Controller('payroll-runs')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'payroll')
@ApiBearerAuth('access-token')
export class PayrollRunsController {
  constructor(private readonly service: PayrollRunsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.RUN_PAYROLL)
  @ApiOperation({
    summary:
      'Run payroll for one payslip type and month, and send it for approval',
  })
  @ApiResponse({
    status: 400,
    description:
      'Someone has no group, a configuration is not usable, or deductions exceed pay',
  })
  @ApiResponse({
    status: 409,
    description: 'That type has already been run for the month',
  })
  run(@Body() dto: RunConfiguredPayrollDto, @Req() req: AuthedRequest) {
    return this.service.run(req.user.tenantId, req.user, dto);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.APPROVE_PAYROLL)
  @ApiOperation({
    summary: 'Approve every run of the month that is waiting for approval',
  })
  approve(@Body() dto: ApprovePayrollMonthDto, @Req() req: AuthedRequest) {
    return this.service.approveMonth(req.user.tenantId, req.user, dto);
  }
}

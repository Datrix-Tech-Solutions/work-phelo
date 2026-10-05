import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthenticatedInternalRequest,
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '../auth/guards/internal-service-auth.guard';
import {
  PostPayrollAccrualDto,
  QueryPayrollSettlementStatusDto,
} from './dto/payroll-integration.dto';
import { PayrollIntegrationService } from './payroll-integration.service';
import { PayrollSetupService } from './payroll-setup.service';
import { registeredModuleFor } from './source-transactions/source-registry';

@ApiTags('Internal Accounting Payroll Integration')
@Controller('internal/payroll-integration')
@UseGuards(InternalServiceAuthGuard)
export class InternalPayrollIntegrationController {
  constructor(
    private readonly service: PayrollIntegrationService,
    private readonly setup: PayrollSetupService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Whether payroll is linked to Accounting and ready to post',
    description:
      'Asked by payroll when a run is about to be approved. Not linked means payroll runs on its own; linked but not ready lists the payroll accounts still to be chosen.',
  })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
  @ApiOkResponse({ description: 'Link and readiness status.' })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  getStatus(
    @Req() request: AuthenticatedInternalRequest,
    @Query() query: QueryPayrollSettlementStatusDto,
  ) {
    this.assertCaller(request);
    return this.setup.getStatus(query.tenantId);
  }

  @Post('post-accrual')
  @ApiOperation({
    summary: "Post (or draft) a payroll run's accrual journal entry",
    description:
      'Idempotent per payrollRunId. Requires the payroll GL accounts to already be seeded ' +
      'via the tenant-facing seed endpoint.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.service,
    required: true,
    description:
      'Calling service name from INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp,
    required: true,
    description: 'Current Unix timestamp in seconds.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.signature,
    required: true,
    description:
      'Hex HMAC-SHA256 of service:timestamp:POST:/internal/payroll-integration/post-accrual.',
  })
  @ApiCreatedResponse({
    description: 'The created (or already-existing) journal entry.',
  })
  @ApiBadRequestResponse({
    description:
      'Payroll GL accounts are not set up, or no open fiscal period covers the date.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  postAccrual(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: PostPayrollAccrualDto,
  ) {
    this.assertCaller(request);
    if (!request.internalActingUserId) {
      throw new ForbiddenException(
        'A signed request that names the acting user is required to post a payroll accrual.',
      );
    }
    return this.service.postAccrual(
      request.internalServiceName,
      request.internalActingUserId,
      dto,
    );
  }

  @Get(':payrollRunId/settlement-status')
  @ApiOperation({
    summary:
      "A payroll run's per-liability-line settlement status (Net Pay, Income Tax, Social Security)",
  })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.service, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp, required: true })
  @ApiHeader({ name: INTERNAL_SERVICE_AUTH_HEADERS.signature, required: true })
  @ApiOkResponse({ description: 'Settlement status for each liability line.' })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  getSettlementStatus(
    @Req() request: AuthenticatedInternalRequest,
    @Param('payrollRunId', ParseUUIDPipe) payrollRunId: string,
    @Query() query: QueryPayrollSettlementStatusDto,
  ) {
    this.assertCaller(request);
    return this.service.getSettlementStatus(query.tenantId, payrollRunId);
  }

  /** The allow-list admits any trusted service, so payroll's routes are pinned to its own. */
  private assertCaller(request: AuthenticatedInternalRequest) {
    const registration = registeredModuleFor('HR');
    if (request.internalServiceName !== registration?.serviceName) {
      throw new ForbiddenException(
        `Only ${registration?.serviceName ?? 'hr-service'} may call payroll integration routes.`,
      );
    }
  }
}

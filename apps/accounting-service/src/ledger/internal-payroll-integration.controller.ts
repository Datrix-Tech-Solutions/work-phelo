import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthenticatedInternalRequest,
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '../auth/guards/internal-service-auth.guard';
import { PostPayrollAccrualDto } from './dto/payroll-integration.dto';
import { PayrollIntegrationService } from './payroll-integration.service';

@ApiTags('Internal Accounting Payroll Integration')
@Controller('internal/payroll-integration')
@UseGuards(InternalServiceAuthGuard)
export class InternalPayrollIntegrationController {
  constructor(private readonly service: PayrollIntegrationService) {}

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
    return this.service.postAccrual(request.internalServiceName, dto);
  }
}

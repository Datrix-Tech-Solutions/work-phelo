import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ProcessReinsuranceAccountingOutboxDto } from './reinsurance-accounting-readiness.dto';
import { ReinsuranceAccountingReadinessService } from './reinsurance-accounting-readiness.service';

@Controller('accounting-integration')
@ApiTags('Reinsurance - Accounting Integration')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
@RequirePermissions('operations.reinsurance.dashboard:VIEW')
export class ReinsuranceAccountingIntegrationController {
  constructor(
    private readonly readiness: ReinsuranceAccountingReadinessService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get Reinsurance Accounting integration readiness status',
  })
  status(@Req() request: Request & { user: RequestUser }) {
    return this.readiness.status(request.user);
  }

  @Post('counterparties/:counterpartyId/subledger/sync')
  @ApiOperation({
    summary: 'Synchronize one Cedant/Reinsurer counterparty to Accounting',
    description:
      'Ensures the tenant Accounting subledger exists when Accounting is enabled. This does not publish financial source events.',
  })
  syncCounterparty(
    @Param('counterpartyId', ParseUUIDPipe) counterpartyId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.syncCounterpartyById(request.user, counterpartyId);
  }

  @Post('outbox/process-pending')
  @ApiOperation({
    summary: 'Dispatch pending Reinsurance Accounting outbox events',
    description:
      'Operational dispatcher for already-enqueued outbox rows. This endpoint does not create new financial events.',
  })
  processPending(
    @Query() query: ProcessReinsuranceAccountingOutboxDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.processPending(request.user, query);
  }
}

import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../../auth/decorators/feature.decorator';
import { RequireModule } from '../../auth/decorators/module.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../../auth/guards/feature.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { PaymentWorklistResponseDto } from '../dto/payment-worklist-response.dto';
import { FacultativeRowStateResponseDto } from '../dto/facultative-row-state-response.dto';
import { QueryFacultativeRowStateDto } from '../dto/query-facultative-row-state.dto';
import { QueryPaymentWorklistDto } from '../dto/query-payment-worklist.dto';
import { PlacementPermission } from '../placement.permissions';
import { ReinsuranceFacultativeRowStateService } from './facultative-row-state.service';
import { ReinsurancePaymentsWorklistService } from './payments-worklist.service';

@Controller('worklists')
@ApiTags('Reinsurance - Worklists')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid session/token.' })
@ApiForbiddenResponse({
  description:
    'Operations/Reinsurance entitlement or placement view permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class ReinsuranceWorklistsController {
  constructor(
    private readonly paymentsWorklist: ReinsurancePaymentsWorklistService,
    private readonly facultativeRowState: ReinsuranceFacultativeRowStateService,
  ) {}

  @Get('payments')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'List Reinsurance payment worklist rows',
    description:
      'Returns row-ready premium payment placement data in one bounded tenant-scoped request. ' +
      'The list replaces frontend placement preload plus per-placement financial-position/payment fan-out.',
  })
  @ApiOkResponse({ type: PaymentWorklistResponseDto })
  findPayments(
    @Query() query: QueryPaymentWorklistDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.paymentsWorklist.findPayments(request.user.tenantId, query);
  }

  @Get('facultative-row-state')
  @RequirePermissions(PlacementPermission.VIEW)
  @ApiOperation({
    summary: 'Get Facultative placement row state',
    description:
      'Returns bounded tenant-scoped row state for visible Facultative placement rows. ' +
      'This avoids frontend per-placement payments, financial-position and endorsement fan-out.',
  })
  @ApiOkResponse({ type: FacultativeRowStateResponseDto })
  findFacultativeRowState(
    @Query() query: QueryFacultativeRowStateDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.facultativeRowState.findRowState(request.user.tenantId, query);
  }
}

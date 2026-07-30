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
import {
  ProcessReinsuranceAccountingOutboxDto,
  ReconcileDebitNoteAccountingEventsDto,
  ReconcilePaymentAccountingEventsDto,
} from './reinsurance-accounting-readiness.dto';
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

  @Post('reconciliation/debit-note-issued')
  @ApiOperation({
    summary: 'Reconcile issued placement debit notes with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets issued placement debit notes missing their deterministic DEBIT_NOTE_ISSUED outbox row.',
  })
  reconcileDebitNoteIssuedEvents(
    @Query() query: ReconcileDebitNoteAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcileDebitNoteIssuedEvents(request.user, query);
  }

  @Post('reconciliation/credit-note-issued')
  @ApiOperation({
    summary: 'Reconcile issued placement credit notes with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets issued placement credit notes missing their deterministic CREDIT_NOTE_ISSUED outbox row.',
  })
  reconcileCreditNoteIssuedEvents(
    @Query() query: ReconcileDebitNoteAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcileCreditNoteIssuedEvents(request.user, query);
  }

  @Post('reconciliation/endorsement-debit-note-issued')
  @ApiOperation({
    summary: 'Reconcile issued endorsement debit notes with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets issued endorsement debit notes missing their deterministic ENDORSEMENT_DEBIT_NOTE_ISSUED outbox row.',
  })
  reconcileEndorsementDebitNoteIssuedEvents(
    @Query() query: ReconcileDebitNoteAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcileEndorsementDebitNoteIssuedEvents(
      request.user,
      query,
    );
  }

  @Post('reconciliation/endorsement-credit-note-issued')
  @ApiOperation({
    summary: 'Reconcile issued endorsement credit notes with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets issued endorsement credit notes missing their deterministic ENDORSEMENT_CREDIT_NOTE_ISSUED outbox row.',
  })
  reconcileEndorsementCreditNoteIssuedEvents(
    @Query() query: ReconcileDebitNoteAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcileEndorsementCreditNoteIssuedEvents(
      request.user,
      query,
    );
  }

  @Post('reconciliation/premium-payment-received')
  @ApiOperation({
    summary: 'Reconcile recorded premium payments with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets premium receipt payment rows missing their deterministic PREMIUM_PAYMENT_RECEIVED outbox row.',
  })
  reconcilePremiumPaymentReceivedEvents(
    @Query() query: ReconcilePaymentAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcilePremiumPaymentReceivedEvents(
      request.user,
      query,
    );
  }

  @Post('reconciliation/payment-reversed')
  @ApiOperation({
    summary: 'Reconcile premium payment reversals with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets reversal payment rows missing their deterministic PAYMENT_REVERSED outbox row.',
  })
  reconcilePaymentReversedEvents(
    @Query() query: ReconcilePaymentAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcilePaymentReversedEvents(request.user, query);
  }

  @Post('reconciliation/reinsurer-disbursement-recorded')
  @ApiOperation({
    summary:
      'Reconcile bank-confirmed reinsurer disbursements with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets bank-confirmed outbound reinsurer payments missing their deterministic REINSURER_DISBURSEMENT_RECORDED outbox row.',
  })
  reconcileReinsurerDisbursementRecordedEvents(
    @Query() query: ReconcilePaymentAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcileReinsurerDisbursementRecordedEvents(
      request.user,
      query,
    );
  }
}

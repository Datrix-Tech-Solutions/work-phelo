import {
  Controller,
  Get,
  GoneException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiOkResponse,
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
  AccountingOutboxDispatcherStatusDto,
  ProcessReinsuranceAccountingOutboxDto,
  ReconcileDebitNoteAccountingEventsDto,
  ReconcilePaymentAccountingEventsDto,
} from './readiness/readiness.dto';
import { ReinsuranceAccountingOutboxDispatcher } from './outbox/outbox-dispatcher.service';
import { ReinsuranceAccountingIntegrationActiveGuard } from './guards/integration-active.guard';
import { ReinsuranceAccountingOperationAuditInterceptor } from './audit/operation-audit.interceptor';
import { ReinsuranceAccountingReadinessService } from './readiness/readiness.service';

@Controller('accounting-integration')
@ApiTags('Reinsurance - Accounting Integration')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class ReinsuranceAccountingIntegrationController {
  constructor(
    private readonly readiness: ReinsuranceAccountingReadinessService,
    private readonly dispatcher: ReinsuranceAccountingOutboxDispatcher,
  ) {}

  @Get('status')
  @RequirePermissions('operations.reinsurance.dashboard:VIEW')
  @ApiOperation({
    summary: 'Get Reinsurance Accounting integration readiness status',
  })
  status(@Req() request: Request & { user: RequestUser }) {
    return this.readiness.status(request.user);
  }

  @Post('counterparties/:counterpartyId/subledger/sync')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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

  @Get('outbox/dispatcher/status')
  @RequirePermissions('operations.reinsurance.accounting-operations:VIEW')
  @ApiOperation({
    summary: 'Get Reinsurance Accounting outbox dispatcher status',
    description:
      'Reports automatic dispatcher configuration and recent batch activity. The endpoint is authenticated, requires the existing Reinsurance dashboard view permission, and is observational only. It does not create, dispatch or expose financial-event payloads.',
  })
  @ApiOkResponse({ type: AccountingOutboxDispatcherStatusDto })
  dispatcherStatus() {
    return this.dispatcher.status();
  }

  @Get('financial-confirmations/claim-recovery-receipts')
  @RequirePermissions('operations.reinsurance.dashboard:VIEW')
  @ApiOperation({
    summary: 'Claim recovery receipt Accounting confirmation queue is retired',
    description:
      'Reinsurance Claims are financially confirmed inside Reinsurance and no longer enter the Accounting confirmation queue.',
  })
  findPendingClaimRecoveryReceiptConfirmations() {
    throw new GoneException(
      'Reinsurance claim recovery receipts are financially confirmed inside Reinsurance and no longer enter Accounting confirmation queues.',
    );
  }

  @Get('financial-confirmations/claim-cedant-settlements')
  @RequirePermissions('operations.reinsurance.dashboard:VIEW')
  @ApiOperation({
    summary: 'Claim cedant settlement Accounting confirmation queue is retired',
    description:
      'Reinsurance Claims are financially confirmed inside Reinsurance and no longer enter the Accounting confirmation queue.',
  })
  findPendingClaimCedantSettlementConfirmations() {
    throw new GoneException(
      'Reinsurance claim cedant settlements are financially confirmed inside Reinsurance and no longer enter Accounting confirmation queues.',
    );
  }

  @Post('reconciliation/debit-note-issued')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
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

  @Post('reconciliation/reinsurer-disbursement-reversed')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary:
      'Reconcile reversed reinsurer disbursements with Accounting outbox',
    description:
      'Tenant-scoped support operation. Defaults to dry-run and only targets immutable outbound reinsurer disbursement reversal rows missing their deterministic REINSURER_DISBURSEMENT_REVERSED outbox row.',
  })
  reconcileReinsurerDisbursementReversedEvents(
    @Query() query: ReconcilePaymentAccountingEventsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.readiness.reconcileReinsurerDisbursementReversedEvents(
      request.user,
      query,
    );
  }

  @Post('reconciliation/claim-payable-approved')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim payable Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimPayableApprovedEvents() {
    throw new GoneException(
      'Claim payable Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-recovery-approved')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim recovery Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimRecoveryApprovedEvents() {
    throw new GoneException(
      'Claim recovery Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-cedant-settlement-paid')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim cedant settlement Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimCedantSettlementPaidEvents() {
    throw new GoneException(
      'Claim cedant settlement Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-cedant-settlement-reversed')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary:
      'Claim cedant settlement reversal Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimCedantSettlementReversedEvents() {
    throw new GoneException(
      'Claim cedant settlement reversal Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-recovery-received')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary: 'Claim recovery receipt Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimRecoveryReceivedEvents() {
    throw new GoneException(
      'Claim recovery receipt Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }

  @Post('reconciliation/claim-recovery-receipt-reversed')
  @UseInterceptors(ReinsuranceAccountingOperationAuditInterceptor)
  @UseGuards(ReinsuranceAccountingIntegrationActiveGuard)
  @RequirePermissions('operations.reinsurance.accounting-operations:EDIT')
  @ApiOperation({
    summary:
      'Claim recovery receipt reversal Accounting reconciliation is retired',
    description:
      'Reinsurance Claims no longer publish Accounting events. This compatibility endpoint fails safely and never creates outbox rows.',
  })
  reconcileClaimRecoveryReceiptReversedEvents() {
    throw new GoneException(
      'Claim recovery receipt reversal Accounting reconciliation is retired; Reinsurance Claims are financially controlled inside Reinsurance.',
    );
  }
}

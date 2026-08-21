import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { ReinsuranceAccountingIntegrationModule } from '../accounting-integration/reinsurance-accounting-integration.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReinsuranceChargeSettingsModule } from '../settings/reinsurance-charge-settings.module';
import { ClaimAllocationCalculator } from './claims/allocation/allocation.calculator';
import { ClosingSnapshotReader } from './closing-snapshot.reader';
import { PlacementFinancialActivityReader } from './placement-financial-activity.reader';
import { PlacementFinancialLockPolicy } from './placement-financial-lock.policy';
import { PlacementFinancialPositionService } from './placement-financial-position.service';
import { PlacementClaimCashCallsService } from './claims/cash-calls/cash-calls.service';
import { PlacementClaimCedantSettlementsService } from './claims/settlements/cedant-settlements.service';
import { PlacementClaimFinancialCloseReadinessService } from './claims/close/financial-close-readiness.service';
import { PlacementClaimRecoveryApprovalsService } from './claims/recoveries/recovery-approvals.service';
import { PlacementClaimRecoveryReceiptsService } from './claims/recoveries/recovery-receipts.service';
import { PlacementClaimsService } from './claims/claims.service';
import { PlacementAttachmentsController } from './placement-attachments.controller';
import { PlacementAttachmentsService } from './placement-attachments.service';
import { PlacementClosingsService } from './placement-closings.service';
import { PlacementDocumentsService } from './placement-documents.service';
import { PlacementEndorsementClosingsService } from './placement-endorsement-closings.service';
import { PlacementEndorsementsService } from './placement-endorsements.service';
import { PlacementEndorsementParticipantsService } from './placement-endorsement-participants.service';
import { PlacementEffectivePositionService } from './placement-effective-position.service';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { PlacementNotesService } from './placement-notes.service';
import { PlacementPaymentsService } from './placement-payments.service';
import { PlacementDocumentTemplateRegistry } from './pdf/placement-document-template.registry';
import { PlacementPdfRendererService } from './pdf/placement-pdf-renderer.service';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';
import { ReinsuranceDashboardController } from './reinsurance-dashboard.controller';
import { ReinsuranceDashboardService } from './reinsurance-dashboard.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';
import { S3DocumentStorageService } from './storage/s3-document-storage.service';
import { TenantDocumentProfileClient } from './tenant-document-profile.client';

@Module({
  imports: [
    PrismaModule,
    RabbitMQModule,
    ReinsuranceChargeSettingsModule,
    ReinsuranceAccountingIntegrationModule,
  ],
  controllers: [
    PlacementsController,
    PlacementAttachmentsController,
    ReinsuranceDashboardController,
  ],
  providers: [
    PlacementsService,
    ReinsuranceDashboardService,
    PlacementAttachmentsService,
    PlacementClaimsService,
    PlacementClaimCashCallsService,
    PlacementClaimCedantSettlementsService,
    PlacementClaimFinancialCloseReadinessService,
    PlacementClaimRecoveryApprovalsService,
    PlacementClaimRecoveryReceiptsService,
    PlacementClosingsService,
    PlacementDocumentsService,
    PlacementEndorsementsService,
    PlacementEndorsementParticipantsService,
    PlacementEndorsementClosingsService,
    PlacementEffectivePositionService,
    PlacementEffectiveViewService,
    PlacementNotesService,
    PlacementPaymentsService,
    PlacementDocumentTemplateRegistry,
    PlacementPdfRendererService,
    S3DocumentStorageService,
    PlacementFinancialActivityReader,
    PlacementFinancialLockPolicy,
    PlacementFinancialPositionService,
    ReinsuranceMoneyHelper,
    ClosingSnapshotReader,
    ClaimAllocationCalculator,
    TenantDocumentProfileClient,
  ],
  exports: [
    PlacementsService,
    PlacementAttachmentsService,
    PlacementDocumentsService,
    S3DocumentStorageService,
  ],
})
export class PlacementsModule {}

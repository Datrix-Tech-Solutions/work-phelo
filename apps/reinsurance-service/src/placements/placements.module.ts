import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClaimAllocationCalculator } from './claim-allocation.calculator';
import { ClosingSnapshotReader } from './closing-snapshot.reader';
import { PlacementFinancialActivityReader } from './placement-financial-activity.reader';
import { PlacementFinancialLockPolicy } from './placement-financial-lock.policy';
import { PlacementClaimCashCallsService } from './placement-claim-cash-calls.service';
import { PlacementClaimsService } from './placement-claims.service';
import { PlacementClosingsService } from './placement-closings.service';
import { PlacementDocumentsService } from './placement-documents.service';
import { PlacementEndorsementClosingsService } from './placement-endorsement-closings.service';
import { PlacementEndorsementsService } from './placement-endorsements.service';
import { PlacementEndorsementParticipantsService } from './placement-endorsement-participants.service';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { PlacementNotesService } from './placement-notes.service';
import { PlacementPaymentsService } from './placement-payments.service';
import { PlacementDocumentTemplateRegistry } from './pdf/placement-document-template.registry';
import { PlacementPdfRendererService } from './pdf/placement-pdf-renderer.service';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';
import { S3DocumentStorageService } from './storage/s3-document-storage.service';

@Module({
  imports: [PrismaModule, RabbitMQModule],
  controllers: [PlacementsController],
  providers: [
    PlacementsService,
    PlacementClaimsService,
    PlacementClaimCashCallsService,
    PlacementClosingsService,
    PlacementDocumentsService,
    PlacementEndorsementsService,
    PlacementEndorsementParticipantsService,
    PlacementEndorsementClosingsService,
    PlacementEffectiveViewService,
    PlacementNotesService,
    PlacementPaymentsService,
    PlacementDocumentTemplateRegistry,
    PlacementPdfRendererService,
    S3DocumentStorageService,
    PlacementFinancialActivityReader,
    PlacementFinancialLockPolicy,
    ReinsuranceMoneyHelper,
    ClosingSnapshotReader,
    ClaimAllocationCalculator,
  ],
  exports: [PlacementsService],
})
export class PlacementsModule {}

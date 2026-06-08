import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClaimAllocationCalculator } from './claim-allocation.calculator';
import { ClosingSnapshotReader } from './closing-snapshot.reader';
import { PlacementFinancialActivityReader } from './placement-financial-activity.reader';
import { PlacementFinancialLockPolicy } from './placement-financial-lock.policy';
import { PlacementClaimsService } from './placement-claims.service';
import { PlacementClosingsService } from './placement-closings.service';
import { PlacementEndorsementClosingsService } from './placement-endorsement-closings.service';
import { PlacementEndorsementsService } from './placement-endorsements.service';
import { PlacementEndorsementParticipantsService } from './placement-endorsement-participants.service';
import { PlacementNotesService } from './placement-notes.service';
import { PlacementPaymentsService } from './placement-payments.service';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

@Module({
  imports: [PrismaModule, RabbitMQModule],
  controllers: [PlacementsController],
  providers: [
    PlacementsService,
    PlacementClaimsService,
    PlacementClosingsService,
    PlacementEndorsementsService,
    PlacementEndorsementParticipantsService,
    PlacementEndorsementClosingsService,
    PlacementNotesService,
    PlacementPaymentsService,
    PlacementFinancialActivityReader,
    PlacementFinancialLockPolicy,
    ReinsuranceMoneyHelper,
    ClosingSnapshotReader,
    ClaimAllocationCalculator,
  ],
  exports: [PlacementsService],
})
export class PlacementsModule {}

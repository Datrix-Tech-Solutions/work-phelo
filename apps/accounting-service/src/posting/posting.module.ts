import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PostingRulesController } from './posting-rules.controller';
import { PostingRulesService } from './posting-rules.service';
import { SourceEventsController } from './source-events.controller';
import { SourceEventsService } from './source-events.service';

@Module({
  imports: [PrismaModule, AuthModule, LedgerModule],
  controllers: [PostingRulesController, SourceEventsController],
  providers: [PostingRulesService, SourceEventsService],
  exports: [PostingRulesService, SourceEventsService],
})
export class PostingModule {}

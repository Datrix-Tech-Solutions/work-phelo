import { Module } from '@nestjs/common';
import { AppraisalsService } from './appraisals.service';
import { AppraisalsController } from './appraisals.controller';

@Module({
  controllers: [AppraisalsController],
  providers: [AppraisalsService],
  exports: [AppraisalsService],
})
export class AppraisalsModule {}

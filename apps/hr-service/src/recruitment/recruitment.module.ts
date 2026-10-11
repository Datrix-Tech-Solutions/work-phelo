import { Module } from '@nestjs/common';
import {
  RecruitmentController,
  RecruitmentPublicController,
} from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';

@Module({
  controllers: [RecruitmentController, RecruitmentPublicController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}

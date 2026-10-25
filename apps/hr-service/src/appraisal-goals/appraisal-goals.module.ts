import { Module } from '@nestjs/common';
import {
  AppraisalGoalsController,
  AppraisalObjectivesController,
} from './appraisal-goals.controller';
import { AppraisalGoalsService } from './appraisal-goals.service';
import { AppraisalObjectivesService } from './appraisal-objectives.service';
import { AppraisalGoalCyclesService } from './appraisal-goal-cycles.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AppraisalGoalsController, AppraisalObjectivesController],
  providers: [
    AppraisalGoalsService,
    AppraisalObjectivesService,
    AppraisalGoalCyclesService,
  ],
  exports: [
    AppraisalGoalsService,
    AppraisalObjectivesService,
    AppraisalGoalCyclesService,
  ],
})
export class AppraisalGoalsModule {}

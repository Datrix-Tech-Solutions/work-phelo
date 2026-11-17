import { Module } from '@nestjs/common';
import {
  AppraisalGoalsController,
  AppraisalGroupsController,
  AppraisalObjectivesController,
} from './appraisal-goals.controller';
import { AppraisalGoalsService } from './appraisal-goals.service';
import { AppraisalGroupsService } from './appraisal-groups.service';
import { AppraisalObjectivesService } from './appraisal-objectives.service';
import { AppraisalGoalCyclesService } from './appraisal-goal-cycles.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    AppraisalGoalsController,
    AppraisalGroupsController,
    AppraisalObjectivesController,
  ],
  providers: [
    AppraisalGoalsService,
    AppraisalGroupsService,
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

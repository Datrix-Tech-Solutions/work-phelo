import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectTemplatesController } from './project-templates.controller';
import { ProjectTemplatesService } from './project-templates.service';
import { ProjectInvoicesService } from './project-invoices.service';
import { ProjectTimeService } from './project-time.service';
import { ProjectWorkController } from './project-work.controller';
import { ProjectWorkService } from './project-work.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    ProjectsController,
    ProjectWorkController,
    ProjectTemplatesController,
  ],
  providers: [
    ProjectsService,
    ProjectWorkService,
    ProjectTimeService,
    ProjectInvoicesService,
    ProjectTemplatesService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}

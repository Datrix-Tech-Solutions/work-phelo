import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectTemplatesController } from './project-templates.controller';
import { ProjectTemplatesService } from './project-templates.service';
import { ProjectInvoicesService } from './project-invoices.service';
import { ProjectTimeService } from './project-time.service';
import { ProjectWorkController } from './project-work.controller';
import { ProjectWorkService } from './project-work.service';
import { ProjectAccountingClient } from './billing/project-accounting.client';
import { ProjectClientsController } from './billing/project-clients.controller';
import { ProjectClientsService } from './billing/project-clients.service';
import { InternalProjectAccountingEventsController } from './billing/internal-project-accounting-events.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    // Before the project routes, so `projects/clients` is never read as a project id.
    ProjectClientsController,
    InternalProjectAccountingEventsController,
    ProjectsController,
    ProjectWorkController,
    ProjectTemplatesController,
  ],
  providers: [
    ProjectsService,
    ProjectWorkService,
    ProjectTimeService,
    ProjectInvoicesService,
    ProjectClientsService,
    ProjectAccountingClient,
    ProjectTemplatesService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}

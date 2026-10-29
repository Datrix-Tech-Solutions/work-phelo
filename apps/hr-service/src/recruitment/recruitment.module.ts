import { Module, forwardRef } from '@nestjs/common';
import {
  RecruitmentController,
  RecruitmentPublicController,
} from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentDocumentsService } from './recruitment-documents.service';
import {
  RecruitmentPublicDocumentsController,
  RecruitmentCandidateDocumentsController,
} from './recruitment-documents.controller';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecruitmentNotifier } from './recruitment-notifier.service';
import { EmployeeDocumentStorageService } from '../common/employee-document-storage.service';

@Module({
  imports: [forwardRef(() => RabbitMQModule), NotificationsModule],
  controllers: [
    RecruitmentController,
    RecruitmentPublicController,
    RecruitmentPublicDocumentsController,
    RecruitmentCandidateDocumentsController,
  ],
  providers: [
    RecruitmentService,
    RecruitmentNotifier,
    RecruitmentDocumentsService,
    EmployeeDocumentStorageService,
  ],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}

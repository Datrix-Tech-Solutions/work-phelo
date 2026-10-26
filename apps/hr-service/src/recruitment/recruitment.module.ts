import { Module } from '@nestjs/common';
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
import { EmployeeDocumentStorageService } from '../common/employee-document-storage.service';

@Module({
  controllers: [
    RecruitmentController,
    RecruitmentPublicController,
    RecruitmentPublicDocumentsController,
    RecruitmentCandidateDocumentsController,
  ],
  providers: [
    RecruitmentService,
    RecruitmentDocumentsService,
    EmployeeDocumentStorageService,
  ],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}

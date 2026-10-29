import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  RecruitmentApplicationStatus,
  RecruitmentDocumentType,
} from '../../prisma/generated/client';
import { EmployeeDocumentStorageService } from '../common/employee-document-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecruitmentService } from './recruitment.service';
import {
  ACTIVE_RECRUITMENT_DOCUMENTS,
  lockRecruitmentApplication,
} from './recruitment-document';
import {
  validateRecruitmentDocument,
  validateRecruitmentText,
} from './recruitment-document-validation';

@Injectable()
export class RecruitmentDocumentsService {
  private readonly logger = new Logger(RecruitmentDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recruitment: RecruitmentService,
    private readonly storage: EmployeeDocumentStorageService,
  ) {}

  async upload(
    applicationId: string,
    token: string | undefined,
    type: RecruitmentDocumentType,
    file?: Express.Multer.File,
  ) {
    if (!Object.values(RecruitmentDocumentType).includes(type))
      throw new BadRequestException('Invalid document type');
    return this.save(
      applicationId,
      token,
      type,
      validateRecruitmentDocument(file),
    );
  }

  /** A cover letter the applicant typed instead of uploading; stored as a plain-text document. */
  async saveCoverLetterText(
    applicationId: string,
    token: string | undefined,
    text: string,
  ) {
    return this.save(
      applicationId,
      token,
      RecruitmentDocumentType.COVER_LETTER,
      validateRecruitmentText(text),
    );
  }

  private async save(
    applicationId: string,
    token: string | undefined,
    type: RecruitmentDocumentType,
    validated: { body: Buffer; mimeType: string; originalFileName: string },
  ) {
    const draft = await this.recruitment.getDraftApplicationByToken(
      applicationId,
      token,
    );
    const id = randomUUID();
    const stored = await this.storage.storeRecruitmentDocument({
      ...validated,
      contentType: validated.mimeType,
      tenantId: draft.tenantId,
      applicationId: draft.id,
      documentId: id,
    });
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await lockRecruitmentApplication(tx, applicationId);
        await this.recruitment.getDraftApplicationByToken(
          applicationId,
          token,
          tx,
        );
        const replaced =
          type !== RecruitmentDocumentType.OTHER
            ? await tx.recruitmentApplicationDocument.findMany({
                where: {
                  tenantId: draft.tenantId,
                  applicationId,
                  type,
                  status: 'ACTIVE',
                },
              })
            : [];
        if (type !== RecruitmentDocumentType.OTHER) {
          await tx.recruitmentApplicationDocument.updateMany({
            where: {
              tenantId: draft.tenantId,
              applicationId,
              type,
              status: 'ACTIVE',
            },
            data: { status: 'RETIRED' },
          });
        }
        const document = await tx.recruitmentApplicationDocument.create({
          data: {
            id,
            tenantId: draft.tenantId,
            applicationId,
            type,
            originalFileName: validated.originalFileName,
            storageKey: stored.objectKey,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
          },
          select: ACTIVE_RECRUITMENT_DOCUMENTS.select,
        });
        return { document, replaced };
      });
      for (const old of result.replaced)
        await this.cleanup(old.storageKey, old.id);
      return result.document;
    } catch (error) {
      await this.cleanup(stored.objectKey, id);
      throw error;
    }
  }

  async listDraft(applicationId: string, token?: string) {
    const draft = await this.recruitment.getDraftApplicationByToken(
      applicationId,
      token,
    );
    return {
      items: await this.prisma.recruitmentApplicationDocument.findMany({
        ...ACTIVE_RECRUITMENT_DOCUMENTS,
        where: {
          ...ACTIVE_RECRUITMENT_DOCUMENTS.where,
          tenantId: draft.tenantId,
          applicationId,
        },
      }),
    };
  }

  async retire(applicationId: string, documentId: string, token?: string) {
    const document = await this.prisma.$transaction(async (tx) => {
      await lockRecruitmentApplication(tx, applicationId);
      const draft = await this.recruitment.getDraftApplicationByToken(
        applicationId,
        token,
        tx,
      );
      const existing = await tx.recruitmentApplicationDocument.findFirst({
        where: {
          id: documentId,
          tenantId: draft.tenantId,
          applicationId,
          status: 'ACTIVE',
        },
      });
      if (!existing)
        throw new NotFoundException('Recruitment document not found');
      await tx.recruitmentApplicationDocument.update({
        where: { id: existing.id },
        data: { status: 'RETIRED' },
      });
      return existing;
    });
    await this.cleanup(document.storageKey, document.id);
  }

  async download(tenantId: string, candidateId: string, documentId: string) {
    const document = await this.prisma.recruitmentApplicationDocument.findFirst(
      {
        where: {
          id: documentId,
          tenantId,
          applicationId: candidateId,
          status: 'ACTIVE',
          application: {
            tenantId,
            status: RecruitmentApplicationStatus.SUBMITTED,
          },
        },
      },
    );
    if (!document)
      throw new NotFoundException('Recruitment document not found');
    return this.storage.createSignedReadUrl({
      objectKey: document.storageKey,
      mimeType: document.mimeType,
      fileName: document.originalFileName,
    });
  }

  private async cleanup(storageKey: string, documentId: string) {
    try {
      await this.storage.delete(storageKey);
    } catch {
      this.logger.warn(
        `Recruitment document storage cleanup failed; documentId=${documentId}`,
      );
    }
  }
}

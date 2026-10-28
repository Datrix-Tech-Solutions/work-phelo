import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { RecruitmentDocumentType } from '../../prisma/generated/client';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CoverLetterTextDto,
  UploadRecruitmentDocumentDto,
} from './dto/document.dto';
import { MAX_RECRUITMENT_DOCUMENT_BYTES } from './recruitment-document-validation';
import { RecruitmentDocumentsService } from './recruitment-documents.service';

const metadataExample = {
  id: 'document-uuid',
  type: 'RESUME',
  originalFileName: 'Resume.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  createdAt: '2026-10-16T12:00:00.000Z',
};

@ApiTags('HR Recruitment - Public Documents')
@Controller('recruitment/public/applications/:applicationId/documents')
@ApiHeader({
  name: 'x-application-access-token',
  required: true,
  description:
    'Draft token returned when this application was created. No tenant Bearer token is used.',
})
@ApiBadRequestResponse({
  description: 'Invalid document type, file or payload',
})
@ApiNotFoundResponse({
  description:
    'Draft/token or document not found (including submitted applications)',
})
@ApiConflictResponse({ description: 'Vacancy is no longer open' })
export class RecruitmentPublicDocumentsController {
  constructor(private readonly documents: RecruitmentDocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_RECRUITMENT_DOCUMENT_BYTES, files: 1, fields: 1 },
    }),
  )
  @ApiOperation({
    summary: 'Upload or replace a draft application document',
    description:
      'Multipart .pdf (application/pdf), .doc (application/msword), or .docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document), maximum 15 MiB. Extension, MIME and content signature must match. Validated bytes are stored privately before metadata becomes ACTIVE. Uploading the same RESUME/COVER_LETTER type replaces its current document. No separate confirmation step.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'file'],
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: Object.values(RecruitmentDocumentType) },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Active document metadata',
    schema: { example: metadataExample },
  })
  @ApiResponse({ status: 413, description: 'File exceeds 15 MiB' })
  upload(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Headers('x-application-access-token') token: string | undefined,
    @Body() dto: UploadRecruitmentDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(applicationId, token, dto.type, file);
  }

  @Post('cover-letter-text')
  @ApiOperation({
    summary: 'Save or replace a typed cover letter',
    description:
      'Stores the text (max 10,000 characters) as the draft COVER_LETTER document, replacing any current one, so it satisfies a required cover letter exactly like an upload.',
  })
  @ApiCreatedResponse({
    description: 'Active document metadata',
    schema: { example: { ...metadataExample, type: 'COVER_LETTER' } },
  })
  saveCoverLetterText(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Headers('x-application-access-token') token: string | undefined,
    @Body() dto: CoverLetterTextDto,
  ) {
    return this.documents.saveCoverLetterText(applicationId, token, dto.text);
  }

  @Get()
  @ApiOperation({ summary: 'List active documents for the token-owned draft' })
  @ApiOkResponse({ schema: { example: { items: [metadataExample] } } })
  list(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Headers('x-application-access-token') token?: string,
  ) {
    return this.documents.listDraft(applicationId, token);
  }

  @Delete(':documentId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Retire a draft document',
    description:
      'Preserves metadata history and attempts private object cleanup. Submitted documents are immutable.',
  })
  @ApiNoContentResponse({ description: 'Document retired' })
  retire(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Headers('x-application-access-token') token?: string,
  ) {
    return this.documents.retire(applicationId, documentId, token);
  }
}

@ApiTags('HR Recruitment - Candidates')
@Controller('recruitment/candidates/:candidateId/documents')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
@ApiBadRequestResponse({ description: 'Invalid identifier' })
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({
  description: 'HR access and candidate VIEW permission required',
})
@ApiNotFoundResponse({
  description: 'Submitted candidate document not found in this tenant',
})
export class RecruitmentCandidateDocumentsController {
  constructor(private readonly documents: RecruitmentDocumentsService) {}

  @Get(':documentId/download')
  @RequireModule('hr')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({
    summary: 'Get a short-lived private candidate document URL',
    description:
      'Managed ACTIVE documents of SUBMITTED candidates only. Legacy external URLs are listed separately and cannot be signed by this endpoint.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        readUrl: 'https://storage.example/signed-url',
        expiresAt: '2026-10-16T12:02:00.000Z',
      },
    },
  })
  download(
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.documents.download(req.user.tenantId, candidateId, documentId);
  }
}

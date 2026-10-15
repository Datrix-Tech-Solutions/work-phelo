import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Permission } from '@work-phelo/config';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateRecruitmentApplicationDto,
  QueryRecruitmentCandidatesDto,
  UpdateRecruitmentApplicationAnswersDto,
  UpdateRecruitmentApplicationBasicInfoDto,
  UpdateRecruitmentApplicationProfessionalInfoDto,
  UpdateRecruitmentCandidateStageDto,
} from './dto/candidate.dto';
import {
  CreateRecruitmentInterviewDto,
  UpdateRecruitmentInterviewDto,
} from './dto/interview.dto';
import {
  CreateRecruitmentStageDto,
  UpdateRecruitmentStageDto,
} from './dto/stage.dto';
import {
  CreateRecruitmentVacancyDto,
  QueryPublicRecruitmentBoardDto,
  QueryPublicRecruitmentVacanciesDto,
  QueryRecruitmentVacanciesDto,
  SetRecruitmentCutoffDto,
  UpdateRecruitmentVacancyDto,
} from './dto/vacancy.dto';
import { RecruitmentService } from './recruitment.service';

@ApiTags('HR Recruitment - Public')
@ApiBadRequestResponse({ description: 'Invalid public recruitment request' })
@ApiNotFoundResponse({
  description: 'Vacancy or draft application was not found',
})
@ApiConflictResponse({
  description: 'Vacancy is closed or application cannot be submitted',
})
@Controller('recruitment/public')
export class RecruitmentPublicController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('vacancies')
  @ApiOperation({
    summary: 'List public open recruitment vacancies',
    description:
      'Returns only OPEN vacancies for the requested tenant. Draft and closed vacancies are not public.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: true,
    description: 'Tenant identifier for the public job board',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search open vacancies by title or location',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size' })
  @ApiOkResponse({ description: 'Paginated public vacancy list' })
  listPublicVacancies(@Query() query: QueryPublicRecruitmentVacanciesDto) {
    return this.recruitmentService.listPublicVacancies(query);
  }

  @Get('board')
  @ApiOperation({
    summary: 'List open vacancies across all companies',
    description:
      'Public job board feed. Every OPEN vacancy that is still accepting applications is listed. Each item carries tenantId and id, which the vacancy detail and application endpoints require.',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'jobType', required: false })
  @ApiQuery({ name: 'workMode', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Paginated public job board' })
  listPublicBoard(@Query() query: QueryPublicRecruitmentBoardDto) {
    return this.recruitmentService.listPublicBoard(query);
  }

  @Get('vacancies/:vacancyId')
  @ApiOperation({
    summary: 'Get a public open recruitment vacancy',
    description:
      'Includes the public job details supported by the HR recruitment model: title, location, job type, salary range, overview, responsibilities, requirements, acceptance status and vacancy questions. Hiring-company profile details are not currently resolved by HR.',
  })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiQuery({
    name: 'tenantId',
    required: true,
    description: 'Tenant identifier for public vacancy lookup',
  })
  @ApiOkResponse({ description: 'Public vacancy detail' })
  getPublicVacancy(
    @Param('vacancyId') vacancyId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.recruitmentService.getPublicVacancy(tenantId, vacancyId);
  }

  @Post('vacancies/:vacancyId/applications')
  @ApiOperation({
    summary: 'Start a public recruitment application draft',
    description:
      'Creates a DRAFT application. Draft fields may be incomplete. The raw draft access token is returned only in this response and must be supplied in x-application-access-token for later draft reads, updates, review and submit.',
  })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiQuery({
    name: 'tenantId',
    required: true,
    description: 'Tenant identifier for public vacancy lookup',
  })
  @ApiBody({ type: CreateRecruitmentApplicationDto })
  @ApiCreatedResponse({
    description:
      'Draft application created with a one-time raw access token in the response body',
  })
  createPublicApplication(
    @Param('vacancyId') vacancyId: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: CreateRecruitmentApplicationDto,
  ) {
    return this.recruitmentService.createPublicApplication(
      tenantId,
      vacancyId,
      dto,
    );
  }

  @Get('applications/:applicationId')
  @ApiOperation({
    summary: 'Get a public recruitment application draft',
    description:
      'Reads a DRAFT application only when the matching x-application-access-token is supplied. Submitted applications are not accessible through this public draft route.',
  })
  @ApiParam({
    name: 'applicationId',
    description: 'Recruitment application UUID',
  })
  @ApiHeader({
    name: 'x-application-access-token',
    required: true,
    description:
      'Raw draft access token returned only when the draft application was created',
  })
  @ApiOkResponse({ description: 'Public draft application detail' })
  getPublicApplication(
    @Param('applicationId') applicationId: string,
    @Headers('x-application-access-token') accessToken?: string,
  ) {
    return this.recruitmentService.getPublicApplication(
      applicationId,
      accessToken,
    );
  }

  @Patch('applications/:applicationId/basic-info')
  @ApiOperation({
    summary: 'Save public application basic information',
    description:
      'Updates basic applicant fields on a DRAFT application. These fields may remain incomplete until submit-time validation.',
  })
  @ApiParam({
    name: 'applicationId',
    description: 'Recruitment application UUID',
  })
  @ApiHeader({
    name: 'x-application-access-token',
    required: true,
    description: 'Raw draft access token for this application',
  })
  @ApiBody({ type: UpdateRecruitmentApplicationBasicInfoDto })
  @ApiOkResponse({ description: 'Updated public draft application' })
  updatePublicApplicationBasicInfo(
    @Param('applicationId') applicationId: string,
    @Headers('x-application-access-token') accessToken: string | undefined,
    @Body() dto: UpdateRecruitmentApplicationBasicInfoDto,
  ) {
    return this.recruitmentService.updatePublicApplicationBasicInfo(
      applicationId,
      accessToken,
      dto,
    );
  }

  @Patch('applications/:applicationId/professional-info')
  @ApiOperation({
    summary: 'Save public application professional information',
    description:
      'Updates professional information on a DRAFT application. Required submit fields are validated by the review/submit flow, not by each draft save.',
  })
  @ApiParam({
    name: 'applicationId',
    description: 'Recruitment application UUID',
  })
  @ApiHeader({
    name: 'x-application-access-token',
    required: true,
    description: 'Raw draft access token for this application',
  })
  @ApiBody({ type: UpdateRecruitmentApplicationProfessionalInfoDto })
  @ApiOkResponse({ description: 'Updated public draft application' })
  updatePublicApplicationProfessionalInfo(
    @Param('applicationId') applicationId: string,
    @Headers('x-application-access-token') accessToken: string | undefined,
    @Body() dto: UpdateRecruitmentApplicationProfessionalInfoDto,
  ) {
    return this.recruitmentService.updatePublicApplicationProfessionalInfo(
      applicationId,
      accessToken,
      dto,
    );
  }

  @Patch('applications/:applicationId/questions')
  @ApiOperation({
    summary: 'Save public application question answers',
    description:
      'Replaces draft question answers for this application. SHORT_ANSWER and PARAGRAPH answers use answer; YES_NO, MULTIPLE_CHOICE, CHECKBOXES and DROPDOWN answers use selectedOptions.',
  })
  @ApiParam({
    name: 'applicationId',
    description: 'Recruitment application UUID',
  })
  @ApiHeader({
    name: 'x-application-access-token',
    required: true,
    description: 'Raw draft access token for this application',
  })
  @ApiBody({ type: UpdateRecruitmentApplicationAnswersDto })
  @ApiOkResponse({ description: 'Updated public draft application' })
  updatePublicApplicationAnswers(
    @Param('applicationId') applicationId: string,
    @Headers('x-application-access-token') accessToken: string | undefined,
    @Body() dto: UpdateRecruitmentApplicationAnswersDto,
  ) {
    return this.recruitmentService.updatePublicApplicationAnswers(
      applicationId,
      accessToken,
      dto,
    );
  }

  @Get('applications/:applicationId/review')
  @ApiOperation({
    summary: 'Review public application completion status',
    description:
      'Returns canSubmit and a missing-field list. Required applicant fields and required vacancy questions are enforced here and again during submit.',
  })
  @ApiParam({
    name: 'applicationId',
    description: 'Recruitment application UUID',
  })
  @ApiHeader({
    name: 'x-application-access-token',
    required: true,
    description: 'Raw draft access token for this application',
  })
  @ApiOkResponse({ description: 'Draft review summary with canSubmit/missing' })
  reviewPublicApplication(
    @Param('applicationId') applicationId: string,
    @Headers('x-application-access-token') accessToken?: string,
  ) {
    return this.recruitmentService.reviewPublicApplication(
      applicationId,
      accessToken,
    );
  }

  @Post('applications/:applicationId/submit')
  @ApiOperation({
    summary: 'Submit a completed public recruitment application',
    description:
      'Validates the DRAFT application, prevents duplicate submitted vacancy/email combinations, assigns the tenant default recruitment stage, writes initial stage history and makes the application recruiter-visible.',
  })
  @ApiParam({
    name: 'applicationId',
    description: 'Recruitment application UUID',
  })
  @ApiHeader({
    name: 'x-application-access-token',
    required: true,
    description: 'Raw draft access token for this application',
  })
  @ApiOkResponse({ description: 'Submitted recruiter-visible application' })
  submitPublicApplication(
    @Param('applicationId') applicationId: string,
    @Headers('x-application-access-token') accessToken?: string,
  ) {
    return this.recruitmentService.submitPublicApplication(
      applicationId,
      accessToken,
    );
  }
}

@ApiBadRequestResponse({ description: 'Invalid recruitment request' })
@ApiUnauthorizedResponse({ description: 'Authentication is required' })
@ApiForbiddenResponse({
  description: 'HR module access or recruitment permission is required',
})
@ApiNotFoundResponse({ description: 'Recruitment resource was not found' })
@ApiConflictResponse({
  description: 'Recruitment operation conflicts with current state',
})
@Controller('recruitment')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('vacancies')
  @ApiTags('HR Recruitment - Vacancies')
  @RequirePermissions(Permission.READ_RECRUITMENT_VACANCIES)
  @ApiOperation({
    summary: 'List recruitment vacancies for the current tenant',
    description:
      'Lists tenant-scoped vacancies with submitted applicant counts. Draft applications are excluded from applicant counts.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by vacancy lifecycle status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search vacancy title or location',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size' })
  @ApiOkResponse({ description: 'Paginated tenant vacancy list' })
  listVacancies(
    @Query() query: QueryRecruitmentVacanciesDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.listVacancies(req.user.tenantId, query);
  }

  @Post('vacancies')
  @ApiTags('HR Recruitment - Vacancies')
  @RequirePermissions(Permission.CREATE_RECRUITMENT_VACANCY)
  @ApiOperation({
    summary: 'Create a recruitment vacancy',
    description:
      'Creates a tenant vacancy. DRAFT vacancies may be incomplete; OPEN vacancies require title, location, jobType and description.',
  })
  @ApiBody({ type: CreateRecruitmentVacancyDto })
  @ApiCreatedResponse({ description: 'Recruitment vacancy created' })
  createVacancy(
    @Body() dto: CreateRecruitmentVacancyDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.createVacancy(
      req.user.tenantId,
      req.user,
      dto,
    );
  }

  @Get('vacancies/:vacancyId')
  @ApiTags('HR Recruitment - Vacancies')
  @RequirePermissions(Permission.READ_RECRUITMENT_VACANCIES)
  @ApiOperation({ summary: 'Get a recruitment vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiOkResponse({ description: 'Tenant recruitment vacancy detail' })
  getVacancy(
    @Param('vacancyId') vacancyId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.getVacancy(req.user.tenantId, vacancyId);
  }

  @Patch('vacancies/:vacancyId')
  @ApiTags('HR Recruitment - Vacancies')
  @RequirePermissions(Permission.UPDATE_RECRUITMENT_VACANCY)
  @ApiOperation({
    summary: 'Update a recruitment vacancy',
    description:
      'Updates vacancy fields and questions. PATCH can transition DRAFT to OPEN only when required publishing fields are complete.',
  })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiBody({ type: UpdateRecruitmentVacancyDto })
  @ApiOkResponse({ description: 'Recruitment vacancy updated' })
  updateVacancy(
    @Param('vacancyId') vacancyId: string,
    @Body() dto: UpdateRecruitmentVacancyDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.updateVacancy(
      req.user.tenantId,
      req.user,
      vacancyId,
      dto,
    );
  }

  @Post('vacancies/:vacancyId/reopen')
  @ApiTags('HR Recruitment - Vacancies')
  @RequirePermissions(Permission.CLOSE_RECRUITMENT_VACANCY)
  @ApiOperation({
    summary: 'Reopen a closed recruitment vacancy',
    description:
      'Returns a CLOSED vacancy to OPEN so it accepts applications again. Fails if the closing date has passed.',
  })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiOkResponse({ description: 'Recruitment vacancy reopened' })
  reopenVacancy(
    @Param('vacancyId') vacancyId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.reopenVacancy(
      req.user.tenantId,
      req.user,
      vacancyId,
    );
  }

  @Post('vacancies/:vacancyId/cutoff')
  @ApiTags('HR Recruitment - Vacancies')
  @RequirePermissions(Permission.UPDATE_RECRUITMENT_VACANCY)
  @ApiOperation({
    summary: 'Set or clear the match-score cut-off of a vacancy',
    description:
      'Applicants below the cut-off are moved to Rejected, now and as they apply. Applicants the cut-off rejected earlier return to the entry stage once they clear it. Use dryRun to preview the counts.',
  })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiBody({ type: SetRecruitmentCutoffDto })
  @ApiOkResponse({
    description: 'Cut-off applied, with the number of applicants moved',
  })
  @ApiBadRequestResponse({
    description: 'The vacancy has nothing to score against',
  })
  @ApiConflictResponse({ description: 'The tenant has no Rejected stage' })
  setCutoff(
    @Param('vacancyId') vacancyId: string,
    @Body() dto: SetRecruitmentCutoffDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.setVacancyCutoff(
      req.user.tenantId,
      req.user,
      vacancyId,
      dto,
    );
  }

  @Post('vacancies/:vacancyId/close')
  @ApiTags('HR Recruitment - Vacancies')
  @RequirePermissions(Permission.CLOSE_RECRUITMENT_VACANCY)
  @ApiOperation({
    summary: 'Close a recruitment vacancy',
    description:
      'Marks the vacancy CLOSED without deleting applications or stage history.',
  })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiOkResponse({ description: 'Recruitment vacancy closed' })
  closeVacancy(
    @Param('vacancyId') vacancyId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.closeVacancy(
      req.user.tenantId,
      req.user,
      vacancyId,
    );
  }

  @Get('stages')
  @ApiTags('HR Recruitment - Stages')
  @RequirePermissions(Permission.READ_RECRUITMENT_STAGES)
  @ApiOperation({
    summary: 'List recruitment stages for the current tenant',
    description:
      'Returns tenant pipeline stages ordered by sort order. A default stage is used as the initial stage when applications are submitted.',
  })
  @ApiOkResponse({ description: 'Tenant recruitment stage list' })
  listStages(@Req() req: Request & { user: RequestUser }) {
    return this.recruitmentService.listStages(req.user.tenantId);
  }

  @Post('stages')
  @ApiTags('HR Recruitment - Stages')
  @RequirePermissions(Permission.CREATE_RECRUITMENT_STAGE)
  @ApiOperation({ summary: 'Create a recruitment stage' })
  @ApiBody({ type: CreateRecruitmentStageDto })
  @ApiCreatedResponse({ description: 'Recruitment stage created' })
  createStage(
    @Body() dto: CreateRecruitmentStageDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.createStage(req.user.tenantId, dto);
  }

  @Patch('stages/:stageId')
  @ApiTags('HR Recruitment - Stages')
  @RequirePermissions(Permission.UPDATE_RECRUITMENT_STAGE)
  @ApiOperation({
    summary: 'Update a recruitment stage',
    description:
      'Updates stage metadata/order/default flag. Setting one stage as default clears the previous tenant default.',
  })
  @ApiParam({ name: 'stageId', description: 'Recruitment stage UUID' })
  @ApiBody({ type: UpdateRecruitmentStageDto })
  @ApiOkResponse({ description: 'Recruitment stage updated' })
  updateStage(
    @Param('stageId') stageId: string,
    @Body() dto: UpdateRecruitmentStageDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.updateStage(req.user.tenantId, stageId, dto);
  }

  @Delete('stages/:stageId')
  @ApiTags('HR Recruitment - Stages')
  @RequirePermissions(Permission.DELETE_RECRUITMENT_STAGE)
  @ApiOperation({
    summary: 'Delete an unused recruitment stage',
    description:
      'Deletes only unused stages. Stages referenced by candidates or stage history cannot be deleted.',
  })
  @ApiParam({ name: 'stageId', description: 'Recruitment stage UUID' })
  @ApiOkResponse({ description: 'Recruitment stage deleted' })
  deleteStage(
    @Param('stageId') stageId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.deleteStage(req.user.tenantId, stageId);
  }

  @Get('candidates')
  @ApiTags('HR Recruitment - Candidates')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({
    summary: 'List recruitment candidates/applications',
    description:
      'Lists only SUBMITTED applications. DRAFT applications are never recruiter-visible.',
  })
  @ApiQuery({
    name: 'vacancyId',
    required: false,
    description: 'Filter by vacancy UUID',
  })
  @ApiQuery({
    name: 'stageId',
    required: false,
    description: 'Filter by current recruitment stage UUID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search submitted candidates by name or email',
  })
  @ApiQuery({
    name: 'appliedFrom',
    required: false,
    description: 'Submitted/applied timestamp lower bound',
  })
  @ApiQuery({
    name: 'appliedTo',
    required: false,
    description: 'Submitted/applied timestamp upper bound',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size' })
  @ApiOkResponse({ description: 'Paginated submitted candidate list' })
  listCandidates(
    @Query() query: QueryRecruitmentCandidatesDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.listCandidates(req.user.tenantId, query);
  }

  @Get('candidates/:candidateId')
  @ApiTags('HR Recruitment - Candidates')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({
    summary: 'Get a recruitment candidate/application',
    description:
      'Returns a submitted candidate. Draft applications return the same not-found response as missing or cross-tenant records.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiOkResponse({ description: 'Submitted recruitment candidate detail' })
  getCandidate(
    @Param('candidateId') candidateId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.getCandidate(req.user.tenantId, candidateId);
  }

  @Get('candidates/:candidateId/documents')
  @ApiTags('HR Recruitment - Candidates')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({
    summary: 'Get recruitment candidate document references',
    description:
      'Returns document/link references for submitted candidates only. Binary upload/storage is not part of this phase.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiOkResponse({ description: 'Submitted candidate document references' })
  getCandidateDocuments(
    @Param('candidateId') candidateId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.getCandidateDocuments(
      req.user.tenantId,
      candidateId,
    );
  }

  @Patch('candidates/:candidateId/stage')
  @ApiTags('HR Recruitment - Candidates')
  @RequirePermissions(Permission.UPDATE_RECRUITMENT_CANDIDATE_STAGE)
  @ApiOperation({
    summary: 'Move a recruitment candidate to another stage',
    description:
      'Moves a submitted candidate to another tenant recruitment stage and records stage history.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiBody({ type: UpdateRecruitmentCandidateStageDto })
  @ApiOkResponse({ description: 'Candidate stage updated' })
  updateCandidateStage(
    @Param('candidateId') candidateId: string,
    @Body() dto: UpdateRecruitmentCandidateStageDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.moveCandidateStage(
      req.user.tenantId,
      req.user,
      candidateId,
      dto.stageId,
      dto.note,
    );
  }

  @Get('candidates/:candidateId/stage-history')
  @ApiTags('HR Recruitment - Candidates')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({
    summary: 'List recruitment candidate stage history',
    description:
      'Returns stage history for submitted candidates only. Draft applications have no stage history.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiOkResponse({ description: 'Candidate stage history list' })
  getCandidateStageHistory(
    @Param('candidateId') candidateId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.getCandidateStageHistory(
      req.user.tenantId,
      candidateId,
    );
  }

  @Get('candidates/:candidateId/interviews')
  @ApiTags('HR Recruitment - Interviews')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({
    summary: 'List interviews for a recruitment candidate',
    description:
      'Returns every interview scheduled for a submitted candidate, soonest first.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiOkResponse({ description: 'Candidate interview list' })
  listCandidateInterviews(
    @Param('candidateId') candidateId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.listCandidateInterviews(
      req.user.tenantId,
      candidateId,
    );
  }

  @Post('candidates/:candidateId/interviews')
  @ApiTags('HR Recruitment - Interviews')
  @RequirePermissions(Permission.SCHEDULE_RECRUITMENT_INTERVIEW)
  @ApiOperation({
    summary: 'Schedule an interview for a recruitment candidate',
    description:
      'Video interviews need a platform and an http(s) link, phone interviews a phone number, in-person interviews a location. The start time must be in the future.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiBody({ type: CreateRecruitmentInterviewDto })
  @ApiCreatedResponse({ description: 'Interview scheduled' })
  scheduleCandidateInterview(
    @Param('candidateId') candidateId: string,
    @Body() dto: CreateRecruitmentInterviewDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.scheduleCandidateInterview(
      req.user.tenantId,
      req.user,
      candidateId,
      dto,
    );
  }

  @Patch('candidates/:candidateId/interviews/:interviewId')
  @ApiTags('HR Recruitment - Interviews')
  @RequirePermissions(Permission.SCHEDULE_RECRUITMENT_INTERVIEW)
  @ApiOperation({
    summary: 'Reschedule, complete or cancel a candidate interview',
    description:
      'Scheduled interviews can be rescheduled, edited, completed or cancelled. Completed interviews only accept feedback. Cancelled interviews are final.',
  })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiBody({ type: UpdateRecruitmentInterviewDto })
  @ApiOkResponse({ description: 'Interview updated' })
  updateCandidateInterview(
    @Param('candidateId') candidateId: string,
    @Param('interviewId') interviewId: string,
    @Body() dto: UpdateRecruitmentInterviewDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.updateCandidateInterview(
      req.user.tenantId,
      req.user,
      candidateId,
      interviewId,
      dto,
    );
  }
}

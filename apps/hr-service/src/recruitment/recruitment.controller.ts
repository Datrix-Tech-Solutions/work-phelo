import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
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
  UpdateRecruitmentCandidateStageDto,
} from './dto/candidate.dto';
import {
  CreateRecruitmentStageDto,
  UpdateRecruitmentStageDto,
} from './dto/stage.dto';
import {
  CreateRecruitmentVacancyDto,
  QueryPublicRecruitmentVacanciesDto,
  QueryRecruitmentVacanciesDto,
  UpdateRecruitmentVacancyDto,
} from './dto/vacancy.dto';
import { RecruitmentService } from './recruitment.service';

@ApiTags('Recruitment Public')
@Controller('recruitment/public')
export class RecruitmentPublicController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('vacancies')
  @ApiOperation({ summary: 'List public open recruitment vacancies' })
  listPublicVacancies(@Query() query: QueryPublicRecruitmentVacanciesDto) {
    return this.recruitmentService.listPublicVacancies(query);
  }

  @Get('vacancies/:vacancyId')
  @ApiOperation({ summary: 'Get a public open recruitment vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  getPublicVacancy(
    @Param('vacancyId') vacancyId: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.recruitmentService.getPublicVacancy(tenantId, vacancyId);
  }

  @Post('vacancies/:vacancyId/applications')
  @ApiOperation({ summary: 'Submit a public recruitment application' })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiBody({ type: CreateRecruitmentApplicationDto })
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
}

@ApiTags('Recruitment')
@Controller('recruitment')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('vacancies')
  @RequirePermissions(Permission.READ_RECRUITMENT_VACANCIES)
  @ApiOperation({
    summary: 'List recruitment vacancies for the current tenant',
  })
  listVacancies(
    @Query() query: QueryRecruitmentVacanciesDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.listVacancies(req.user.tenantId, query);
  }

  @Post('vacancies')
  @RequirePermissions(Permission.CREATE_RECRUITMENT_VACANCY)
  @ApiOperation({ summary: 'Create a recruitment vacancy' })
  @ApiBody({ type: CreateRecruitmentVacancyDto })
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
  @RequirePermissions(Permission.READ_RECRUITMENT_VACANCIES)
  @ApiOperation({ summary: 'Get a recruitment vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  getVacancy(
    @Param('vacancyId') vacancyId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.getVacancy(req.user.tenantId, vacancyId);
  }

  @Patch('vacancies/:vacancyId')
  @RequirePermissions(Permission.UPDATE_RECRUITMENT_VACANCY)
  @ApiOperation({ summary: 'Update a recruitment vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
  @ApiBody({ type: UpdateRecruitmentVacancyDto })
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

  @Post('vacancies/:vacancyId/close')
  @RequirePermissions(Permission.CLOSE_RECRUITMENT_VACANCY)
  @ApiOperation({ summary: 'Close a recruitment vacancy' })
  @ApiParam({ name: 'vacancyId', description: 'Recruitment vacancy UUID' })
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
  @RequirePermissions(Permission.READ_RECRUITMENT_STAGES)
  @ApiOperation({ summary: 'List recruitment stages for the current tenant' })
  listStages(@Req() req: Request & { user: RequestUser }) {
    return this.recruitmentService.listStages(req.user.tenantId);
  }

  @Post('stages')
  @RequirePermissions(Permission.CREATE_RECRUITMENT_STAGE)
  @ApiOperation({ summary: 'Create a recruitment stage' })
  @ApiBody({ type: CreateRecruitmentStageDto })
  createStage(
    @Body() dto: CreateRecruitmentStageDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.createStage(req.user.tenantId, dto);
  }

  @Patch('stages/:stageId')
  @RequirePermissions(Permission.UPDATE_RECRUITMENT_STAGE)
  @ApiOperation({ summary: 'Update a recruitment stage' })
  @ApiParam({ name: 'stageId', description: 'Recruitment stage UUID' })
  @ApiBody({ type: UpdateRecruitmentStageDto })
  updateStage(
    @Param('stageId') stageId: string,
    @Body() dto: UpdateRecruitmentStageDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.updateStage(req.user.tenantId, stageId, dto);
  }

  @Delete('stages/:stageId')
  @RequirePermissions(Permission.DELETE_RECRUITMENT_STAGE)
  @ApiOperation({ summary: 'Delete an unused recruitment stage' })
  @ApiParam({ name: 'stageId', description: 'Recruitment stage UUID' })
  deleteStage(
    @Param('stageId') stageId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.deleteStage(req.user.tenantId, stageId);
  }

  @Get('candidates')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({ summary: 'List recruitment candidates/applications' })
  listCandidates(
    @Query() query: QueryRecruitmentCandidatesDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.listCandidates(req.user.tenantId, query);
  }

  @Get('candidates/:candidateId')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({ summary: 'Get a recruitment candidate/application' })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  getCandidate(
    @Param('candidateId') candidateId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.getCandidate(req.user.tenantId, candidateId);
  }

  @Get('candidates/:candidateId/documents')
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({ summary: 'Get recruitment candidate document references' })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
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
  @RequirePermissions(Permission.UPDATE_RECRUITMENT_CANDIDATE_STAGE)
  @ApiOperation({ summary: 'Move a recruitment candidate to another stage' })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  @ApiBody({ type: UpdateRecruitmentCandidateStageDto })
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
  @RequirePermissions(Permission.READ_RECRUITMENT_CANDIDATES)
  @ApiOperation({ summary: 'List recruitment candidate stage history' })
  @ApiParam({
    name: 'candidateId',
    description: 'Recruitment application UUID',
  })
  getCandidateStageHistory(
    @Param('candidateId') candidateId: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.recruitmentService.getCandidateStageHistory(
      req.user.tenantId,
      candidateId,
    );
  }
}

import { PermissionExempt } from '../auth/decorators/permissions.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppraisalsService } from './appraisals.service';
import { AppraisalGoalCyclesService } from '../appraisal-goals/appraisal-goal-cycles.service';
import {
  CreateGoalCycleDto,
  SubmitObjectiveRatingsDto,
  UpdateGoalCycleDto,
} from '../appraisal-goals/dto/cycle.dto';
import { CreateAppraisalTemplateDto } from './dto/create-template.dto';
import { CancelAppraisalCycleDto } from './dto/cancel-cycle.dto';
import { FinalizeAppraisalDto } from './dto/finalize-appraisal.dto';
import { ReopenAppraisalDto } from './dto/reopen-appraisal.dto';
import { QueryAppraisalTemplatesDto } from './dto/query-appraisal-templates.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Appraisals')
@Controller('appraisals')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'appraisals')
@ApiBearerAuth('access-token')
export class AppraisalsController {
  constructor(
    private readonly appraisalsService: AppraisalsService,
    private readonly goalCycles: AppraisalGoalCyclesService,
  ) {}

  // ── Cycles ──────────────────────────────────────────────────────────────────

  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Create a new appraisal cycle' })
  @ApiBody({ type: CreateGoalCycleDto })
  @ApiResponse({ status: 201, description: 'Appraisal cycle created' })
  createCycle(
    @Body() dto: CreateGoalCycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.createCycle(req.user.tenantId, req.user.id, dto);
  }

  @PermissionExempt(
    'module-reference',
    'Tenant appraisal cycle catalog for self and manager workflows.',
  )
  @Get('cycles')
  @ApiOperation({ summary: 'List all appraisal cycles for the tenant' })
  @ApiResponse({ status: 200, description: 'Appraisal cycles retrieved' })
  getCycles(@Req() req: AuthenticatedRequest) {
    return this.goalCycles.listCycles(req.user.tenantId);
  }

  @PermissionExempt(
    'module-reference',
    'Tenant appraisal cycle configuration for self and manager workflows.',
  )
  @Get('cycles/:cycleId')
  @ApiOperation({ summary: 'Get a single appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle retrieved' })
  getCycle(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.getCycle(req.user.tenantId, cycleId);
  }

  @Patch('cycles/:cycleId')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Update an appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiBody({ type: UpdateGoalCycleDto })
  @ApiResponse({ status: 200, description: 'Appraisal cycle updated' })
  updateCycle(
    @Param('cycleId') cycleId: string,
    @Body() dto: UpdateGoalCycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.updateCycle(req.user.tenantId, cycleId, dto);
  }

  @Delete('cycles/:cycleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Delete an appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle deleted' })
  deleteCycle(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.deleteCycle(req.user.tenantId, cycleId);
  }

  @Post('cycles/:cycleId/start')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({
    summary:
      'Start an appraisal cycle — generates appraisal records for all employees',
  })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle started' })
  startCycle(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.startCycle(req.user.tenantId, cycleId, req.user);
  }

  @Patch('cycles/:cycleId/cancel')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Cancel an in-progress appraisal cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiBody({ type: CancelAppraisalCycleDto })
  @ApiResponse({ status: 200, description: 'Appraisal cycle cancelled' })
  cancelCycle(
    @Param('cycleId') cycleId: string,
    @Body() dto: CancelAppraisalCycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.cancelCycle(req.user.tenantId, cycleId, dto.reason);
  }

  @Patch('cycles/:cycleId/close')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({
    summary:
      'Close an in-progress cycle — brings the end date forward and stops new objectives counting',
  })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle closed' })
  closeCycle(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.closeCycle(req.user.tenantId, cycleId);
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalGoalCyclesService.listAssessments requires HR appraisal access.',
  )
  @Get('cycles/:cycleId/assessments')
  @ApiOperation({ summary: "Every employee's assessment in a cycle (HR)" })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  listAssessments(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.listAssessments(
      req.user.tenantId,
      req.user,
      cycleId,
    );
  }

  @Get('assessments/mine')
  @RequirePermissions(Permission.READ_OWN_REVIEW)
  @ApiOperation({ summary: "The logged-in employee's assessments" })
  myAssessments(@Req() req: AuthenticatedRequest) {
    return this.goalCycles.myAssessments(req.user.tenantId, req.user);
  }

  @Get('assessments/team')
  @RequirePermissions(Permission.SUBMIT_MANAGER_REVIEW)
  @ApiOperation({ summary: 'Assessments waiting on, or done by, the manager' })
  teamAssessments(@Req() req: AuthenticatedRequest) {
    return this.goalCycles.teamAssessments(req.user.tenantId, req.user);
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalGoalCyclesService.employeeAssessments enforces self or HR access.',
  )
  @Get('assessments/employee/:employeeId')
  @ApiOperation({
    summary: "An employee's assessments across cycles (HR or themselves)",
  })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID' })
  employeeAssessments(
    @Param('employeeId') employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.employeeAssessments(
      req.user.tenantId,
      req.user,
      employeeId,
    );
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalGoalCyclesService.getAssessment checks self, manager or HR access.',
  )
  @Get('assessments/:id')
  @ApiOperation({
    summary: 'One assessment with its goals, objectives and ratings',
  })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  getAssessment(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.goalCycles.getAssessment(req.user.tenantId, req.user, id);
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalsService.getAppraisals enforces tenant-wide appraisal read policy.',
  )
  @Get('cycles/:cycleId/appraisals')
  @ApiOperation({ summary: 'Get all appraisal records for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisals retrieved' })
  getAppraisals(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.getAppraisals(
      req.user.tenantId,
      req.user,
      cycleId,
    );
  }

  @RequirePermissions(Permission.READ_APPRAISALS)
  @Get('cycles/:cycleId/results')
  @ApiOperation({
    summary: 'Get cycle results summary with rating distribution',
  })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Cycle results retrieved' })
  getCycleResults(
    @Param('cycleId') cycleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.getCycleResults(req.user.tenantId, cycleId);
  }

  // ── Templates ───────────────────────────────────────────────────────────────

  @PermissionExempt(
    'module-reference',
    'Tenant appraisal template catalog; mutations require configuration permission.',
  )
  @Get('templates')
  @ApiOperation({ summary: 'List appraisal templates' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Templates retrieved' })
  getTemplates(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAppraisalTemplatesDto,
  ) {
    return this.appraisalsService.getTemplates(
      req.user.tenantId,
      query.page ?? 1,
      query.search,
    );
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Create an appraisal template' })
  @ApiBody({ type: CreateAppraisalTemplateDto })
  @ApiResponse({ status: 201, description: 'Template created' })
  createTemplate(
    @Body() dto: CreateAppraisalTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.createTemplate(req.user.tenantId, dto);
  }

  @Put('templates/:templateId')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Update an appraisal template' })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiBody({ type: CreateAppraisalTemplateDto })
  @ApiResponse({ status: 200, description: 'Template updated' })
  updateTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: Partial<CreateAppraisalTemplateDto>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.updateTemplate(
      req.user.tenantId,
      templateId,
      dto,
    );
  }

  @Delete('templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Delete an appraisal template' })
  @ApiParam({ name: 'templateId', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  deleteTemplate(
    @Param('templateId') templateId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.deleteTemplate(req.user.tenantId, templateId);
  }

  // ── Employee appraisals ─────────────────────────────────────────────────────

  @Get('my')
  @RequirePermissions(Permission.READ_OWN_REVIEW)
  @ApiOperation({ summary: "Get the logged-in employee's own appraisals" })
  @ApiResponse({ status: 200, description: 'My appraisals retrieved' })
  getMyAppraisals(@Req() req: AuthenticatedRequest) {
    return this.appraisalsService.getMyAppraisals(
      req.user.tenantId,
      req.user.id,
    );
  }

  @Get('team')
  @RequirePermissions(Permission.SUBMIT_MANAGER_REVIEW)
  @ApiOperation({ summary: "Get manager's team appraisals for review" })
  @ApiResponse({ status: 200, description: 'Team appraisals retrieved' })
  getTeamAppraisals(@Req() req: AuthenticatedRequest) {
    return this.appraisalsService.getTeamAppraisals(
      req.user.tenantId,
      req.user.id,
    );
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalsService.getAppraisal checks self, direct manager or HR permissions.',
  )
  @Get(':id')
  @ApiOperation({ summary: 'Get a single appraisal record' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal retrieved' })
  getAppraisal(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.appraisalsService.getAppraisal(req.user.tenantId, id, req.user);
  }

  @Patch(':id/self-assessment')
  @RequirePermissions(Permission.SUBMIT_SELF_ASSESSMENT)
  @ApiOperation({ summary: 'Submit self-assessment for an appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: SubmitObjectiveRatingsDto })
  @ApiResponse({ status: 200, description: 'Self-assessment submitted' })
  submitSelf(
    @Param('id') id: string,
    @Body() dto: SubmitObjectiveRatingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.submitSelf(
      req.user.tenantId,
      req.user,
      id,
      dto.ratings,
    );
  }

  @Patch(':id/manager-review')
  @RequirePermissions(Permission.SUBMIT_MANAGER_REVIEW)
  @ApiOperation({ summary: 'Submit manager review for an appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: SubmitObjectiveRatingsDto })
  @ApiResponse({ status: 200, description: 'Manager review submitted' })
  submitManagerReview(
    @Param('id') id: string,
    @Body() dto: SubmitObjectiveRatingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.submitManager(
      req.user.tenantId,
      req.user,
      id,
      dto.ratings,
      dto.comment,
    );
  }

  @Patch(':id/finalize')
  @RequirePermissions(Permission.FINALIZE_APPRAISAL)
  @ApiOperation({ summary: 'Finalize an employee appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: FinalizeAppraisalDto })
  @ApiResponse({ status: 200, description: 'Appraisal finalized' })
  finalizeAppraisal(
    @Param('id') id: string,
    @Body() dto: FinalizeAppraisalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goalCycles.finalize(req.user.tenantId, req.user, id, dto.note);
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalsService.reopenAppraisal checks finalizer or direct-manager redo authority.',
  )
  @Patch(':id/reopen')
  @ApiOperation({ summary: 'Reopen an appraisal for redo' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: ReopenAppraisalDto })
  @ApiResponse({ status: 200, description: 'Appraisal reopened' })
  reopenAppraisal(
    @Param('id') id: string,
    @Body() dto: ReopenAppraisalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appraisalsService.reopenAppraisal(
      req.user.tenantId,
      id,
      req.user,
      dto,
    );
  }
}

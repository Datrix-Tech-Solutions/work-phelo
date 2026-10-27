import { PermissionExempt } from '../auth/decorators/permissions.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AppraisalGoalsService } from './appraisal-goals.service';
import { AppraisalObjectivesService } from './appraisal-objectives.service';
import { CreateAppraisalGoalDto, UpdateAppraisalGoalDto } from './dto/goal.dto';
import {
  AddObjectiveCommentDto,
  CreateAppraisalObjectiveDto,
  LinkAppraisalObjectiveDto,
} from './dto/objective.dto';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Appraisal goals')
@Controller('appraisal-goals')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'appraisals')
@ApiBearerAuth('access-token')
export class AppraisalGoalsController {
  constructor(private readonly goals: AppraisalGoalsService) {}

  @PermissionExempt(
    'module-reference',
    'Tenant appraisal goal catalog; objectives enforce caller scope.',
  )
  @Get()
  @ApiOperation({ summary: 'List goals, flagging the ones in a cycle' })
  list(@Req() req: AuthenticatedRequest) {
    return this.goals.list(req.user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Create a goal' })
  create(
    @Body() dto: CreateAppraisalGoalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goals.create(req.user.tenantId, req.user.id, dto);
  }

  @Patch(':goalId')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Update a goal' })
  update(
    @Param('goalId') goalId: string,
    @Body() dto: UpdateAppraisalGoalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.goals.update(req.user.tenantId, goalId, dto);
  }

  @Delete(':goalId')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({
    summary:
      'Delete a goal that is not in a cycle; its objectives are orphaned',
  })
  remove(@Param('goalId') goalId: string, @Req() req: AuthenticatedRequest) {
    return this.goals.remove(req.user.tenantId, goalId);
  }
}

@ApiTags('Appraisal objectives')
@Controller('appraisal-objectives')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'appraisals')
@ApiBearerAuth('access-token')
export class AppraisalObjectivesController {
  constructor(private readonly objectives: AppraisalObjectivesService) {}

  // The service decides between "for self" and "for others" from who the objective is for.
  @PermissionExempt(
    'service-policy',
    'AppraisalObjectivesController.create delegates caller and tenant scope to its existing policy checks.',
  )
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an objective for yourself or, with permission, someone else',
  })
  create(
    @Body() dto: CreateAppraisalObjectiveDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.objectives.create(req.user.tenantId, req.user, dto);
  }

  @PermissionExempt(
    'module-reference',
    'Tenant appraisal goal catalog; objectives enforce caller scope.',
  )
  @Get('employee/:employeeId')
  @ApiOperation({ summary: "List an employee's objectives" })
  list(
    @Param('employeeId') employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.objectives.listForEmployee(
      req.user.tenantId,
      req.user,
      employeeId,
    );
  }

  @Get('cycle/:cycleId/employee/:employeeId')
  @RequirePermissions(Permission.READ_APPRAISALS)
  @ApiOperation({ summary: "An employee's objectives that count for a cycle" })
  forCycle(
    @Param('cycleId') cycleId: string,
    @Param('employeeId') employeeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.objectives.forCycle(req.user.tenantId, cycleId, employeeId);
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalObjectivesController.link delegates caller and tenant scope to its existing policy checks.',
  )
  @Patch(':objectiveId/goal')
  @ApiOperation({ summary: 'Link an objective to a goal, or unlink it' })
  link(
    @Param('objectiveId') objectiveId: string,
    @Body() dto: LinkAppraisalObjectiveDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.objectives.link(req.user.tenantId, req.user, objectiveId, dto);
  }

  @PermissionExempt(
    'service-policy',
    'AppraisalObjectivesController.addComment delegates caller and tenant scope to its existing policy checks.',
  )
  @Post(':objectiveId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to an objective' })
  addComment(
    @Param('objectiveId') objectiveId: string,
    @Body() dto: AddObjectiveCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.objectives.addComment(
      req.user.tenantId,
      req.user,
      objectiveId,
      dto.body,
    );
  }
}

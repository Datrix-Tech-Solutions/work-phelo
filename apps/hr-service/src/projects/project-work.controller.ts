import { PermissionExempt } from '../auth/decorators/permissions.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import {
  CompleteSprintDto,
  CreateSubtaskDto,
  ObjectiveDto,
  SprintDto,
  UpdateSubtaskDto,
} from './dto/project-work.dto';
import { RecordProjectInvoiceDto } from './dto/project-invoice.dto';
import { ProjectInvoicesService } from './project-invoices.service';
import { StartTimerDto, TimeAmountDto } from './dto/project-time.dto';
import { ProjectTimeService } from './project-time.service';
import { ProjectWorkService } from './project-work.service';

type Req_ = Request & { user: RequestUser };

/** Objectives, subtasks, sprints and task time, all inside one project. */
@ApiTags('Project work')
@Controller('projects/:id')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class ProjectWorkController {
  constructor(
    private readonly work: ProjectWorkService,
    private readonly time: ProjectTimeService,
    private readonly invoices: ProjectInvoicesService,
  ) {}

  // Invoices
  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.listInvoices delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('invoices')
  @ApiOperation({ summary: 'List the invoices raised from a project' })
  listInvoices(@Param('id') id: string, @Req() req: Req_) {
    return this.invoices.list(req.user.tenantId, id, req.user);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.recordInvoice delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('invoices')
  @ApiOperation({ summary: 'Record an invoice raised in Accounting' })
  recordInvoice(
    @Param('id') id: string,
    @Body() dto: RecordProjectInvoiceDto,
    @Req() req: Req_,
  ) {
    return this.invoices.record(req.user.tenantId, id, req.user, dto);
  }

  // Objectives
  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.listObjectives delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('objectives')
  @ApiOperation({ summary: 'List the objectives of a project' })
  listObjectives(@Param('id') id: string, @Req() req: Req_) {
    return this.work.listObjectives(req.user.tenantId, id, req.user);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.createObjective delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('objectives')
  @ApiOperation({ summary: 'Create an objective' })
  createObjective(
    @Param('id') id: string,
    @Body() dto: ObjectiveDto,
    @Req() req: Req_,
  ) {
    return this.work.createObjective(req.user.tenantId, id, req.user, dto);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.updateObjective delegates caller and tenant scope to its existing policy checks.',
  )
  @Patch('objectives/:objectiveId')
  @ApiOperation({ summary: 'Update an objective' })
  updateObjective(
    @Param('id') id: string,
    @Param('objectiveId') objectiveId: string,
    @Body() dto: ObjectiveDto,
    @Req() req: Req_,
  ) {
    return this.work.updateObjective(
      req.user.tenantId,
      id,
      objectiveId,
      req.user,
      dto,
    );
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.removeObjective delegates caller and tenant scope to its existing policy checks.',
  )
  @Delete('objectives/:objectiveId')
  @ApiOperation({
    summary: 'Delete an objective; its tasks stay in the project',
  })
  removeObjective(
    @Param('id') id: string,
    @Param('objectiveId') objectiveId: string,
    @Req() req: Req_,
  ) {
    return this.work.removeObjective(
      req.user.tenantId,
      id,
      objectiveId,
      req.user,
    );
  }

  // Subtasks
  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.listSubtasks delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('subtasks')
  @ApiOperation({ summary: 'List the subtasks of a project' })
  listSubtasks(@Param('id') id: string, @Req() req: Req_) {
    return this.work.listSubtasks(req.user.tenantId, id, req.user);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.createSubtask delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('subtasks')
  @ApiOperation({ summary: 'Create a subtask' })
  createSubtask(
    @Param('id') id: string,
    @Body() dto: CreateSubtaskDto,
    @Req() req: Req_,
  ) {
    return this.work.createSubtask(req.user.tenantId, id, req.user, dto);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.updateSubtask delegates caller and tenant scope to its existing policy checks.',
  )
  @Patch('subtasks/:subtaskId')
  @ApiOperation({ summary: 'Rename a subtask or mark it done' })
  updateSubtask(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
    @Req() req: Req_,
  ) {
    return this.work.updateSubtask(
      req.user.tenantId,
      id,
      subtaskId,
      req.user,
      dto,
    );
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.removeSubtask delegates caller and tenant scope to its existing policy checks.',
  )
  @Delete('subtasks/:subtaskId')
  @ApiOperation({ summary: 'Delete a subtask' })
  removeSubtask(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Req() req: Req_,
  ) {
    return this.work.removeSubtask(req.user.tenantId, id, subtaskId, req.user);
  }

  // Sprints
  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.listSprints delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('sprints')
  @ApiOperation({ summary: 'List the sprints of a project' })
  listSprints(@Param('id') id: string, @Req() req: Req_) {
    return this.work.listSprints(req.user.tenantId, id, req.user);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.createSprint delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('sprints')
  @ApiOperation({ summary: 'Create a sprint' })
  createSprint(
    @Param('id') id: string,
    @Body() dto: SprintDto,
    @Req() req: Req_,
  ) {
    return this.work.createSprint(req.user.tenantId, id, req.user, dto);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.updateSprint delegates caller and tenant scope to its existing policy checks.',
  )
  @Put('sprints/:sprintId')
  @ApiOperation({ summary: 'Update a sprint and the tasks in it' })
  updateSprint(
    @Param('id') id: string,
    @Param('sprintId') sprintId: string,
    @Body() dto: SprintDto,
    @Req() req: Req_,
  ) {
    return this.work.updateSprint(
      req.user.tenantId,
      id,
      sprintId,
      req.user,
      dto,
    );
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.completeSprint delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('sprints/:sprintId/complete')
  @ApiOperation({
    summary: 'Complete a sprint; unfinished tasks go back to the backlog',
  })
  completeSprint(
    @Param('id') id: string,
    @Param('sprintId') sprintId: string,
    @Body() dto: CompleteSprintDto,
    @Req() req: Req_,
  ) {
    return this.work.completeSprint(
      req.user.tenantId,
      id,
      sprintId,
      req.user,
      dto,
    );
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.removeSprint delegates caller and tenant scope to its existing policy checks.',
  )
  @Delete('sprints/:sprintId')
  @ApiOperation({ summary: 'Delete a sprint' })
  removeSprint(
    @Param('id') id: string,
    @Param('sprintId') sprintId: string,
    @Req() req: Req_,
  ) {
    return this.work.removeSprint(req.user.tenantId, id, sprintId, req.user);
  }

  // Time
  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.timeSummary delegates caller and tenant scope to its existing policy checks.',
  )
  @Get('time')
  @ApiOperation({ summary: "Everyone's time on the project's timed tasks" })
  timeSummary(@Param('id') id: string, @Req() req: Req_) {
    return this.time.summary(req.user.tenantId, id, req.user);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.startTimer delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('tasks/:taskId/time/start')
  @ApiOperation({ summary: 'Start your timer on a task' })
  startTimer(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: StartTimerDto,
    @Req() req: Req_,
  ) {
    return this.time.start(req.user.tenantId, id, taskId, req.user, dto);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.pauseTimer delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('tasks/:taskId/time/pause')
  @ApiOperation({ summary: 'Pause your timer on a task' })
  pauseTimer(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Req() req: Req_,
  ) {
    return this.time.pause(req.user.tenantId, id, taskId, req.user);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.addTime delegates caller and tenant scope to its existing policy checks.',
  )
  @Post('tasks/:taskId/time/entries')
  @ApiOperation({ summary: 'Add time you worked without the timer' })
  addTime(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: TimeAmountDto,
    @Req() req: Req_,
  ) {
    return this.time.add(req.user.tenantId, id, taskId, req.user, dto);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectWorkController.setMyTime delegates caller and tenant scope to its existing policy checks.',
  )
  @Put('tasks/:taskId/time/mine')
  @ApiOperation({ summary: 'Set your total time on a task' })
  setMyTime(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: TimeAmountDto,
    @Req() req: Req_,
  ) {
    return this.time.setMine(req.user.tenantId, id, taskId, req.user, dto);
  }
}

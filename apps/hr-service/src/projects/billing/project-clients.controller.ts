import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { PermissionExempt } from '../../auth/decorators/permissions.decorator';
import { RequireModule } from '../../auth/decorators/module.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  CreateProjectClientDto,
  ListProjectClientsQueryDto,
} from '../dto/project-client.dto';
import { ProjectClientsService } from './project-clients.service';

type Req_ = Request & { user: RequestUser };

/** The clients made from project management. Registered before the project routes so `clients` is never read as a project id. */
@ApiTags('Project clients')
@Controller('projects/clients')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class ProjectClientsController {
  constructor(private readonly clients: ProjectClientsService) {}

  @PermissionExempt(
    'service-policy',
    'ProjectClientsController.list delegates caller and tenant scope to its existing policy checks.',
  )
  @Get()
  @ApiOperation({ summary: 'List the clients made from project management' })
  list(@Query() query: ListProjectClientsQueryDto, @Req() req: Req_) {
    return this.clients.list(req.user.tenantId, req.user, query.search);
  }

  @PermissionExempt(
    'service-policy',
    'ProjectClientsController.create delegates caller and tenant scope to its existing policy checks.',
  )
  @Post()
  @ApiOperation({
    summary: 'Add a client by name; a name already there returns that client',
  })
  create(@Body() dto: CreateProjectClientDto, @Req() req: Req_) {
    return this.clients.create(req.user.tenantId, req.user, dto.name);
  }
}

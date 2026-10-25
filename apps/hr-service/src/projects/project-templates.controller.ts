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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ProjectTemplateDto } from './dto/project-template.dto';
import { ProjectTemplatesService } from './project-templates.service';

type Req_ = Request & { user: RequestUser };

@ApiTags('Project templates')
@Controller('project-templates')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class ProjectTemplatesController {
  constructor(private readonly templates: ProjectTemplatesService) {}

  @Get()
  @ApiOperation({ summary: "List the company's project templates" })
  list(@Req() req: Req_) {
    return this.templates.list(req.user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project template' })
  @ApiBody({ type: ProjectTemplateDto })
  create(@Body() dto: ProjectTemplateDto, @Req() req: Req_) {
    return this.templates.create(req.user.tenantId, req.user, dto);
  }

  @Put('defaults/:key')
  @ApiOperation({ summary: "Save the company's edit of a built-in template" })
  @ApiBody({ type: ProjectTemplateDto })
  saveDefault(
    @Param('key') key: string,
    @Body() dto: ProjectTemplateDto,
    @Req() req: Req_,
  ) {
    return this.templates.saveDefault(req.user.tenantId, req.user, key, dto);
  }

  @Delete('defaults/:key')
  @ApiOperation({ summary: 'Restore a built-in template to how it shipped' })
  resetDefault(@Param('key') key: string, @Req() req: Req_) {
    return this.templates.resetDefault(req.user.tenantId, req.user, key);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project template' })
  @ApiBody({ type: ProjectTemplateDto })
  update(
    @Param('id') id: string,
    @Body() dto: ProjectTemplateDto,
    @Req() req: Req_,
  ) {
    return this.templates.update(req.user.tenantId, req.user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project template' })
  remove(@Param('id') id: string, @Req() req: Req_) {
    return this.templates.remove(req.user.tenantId, req.user, id);
  }
}

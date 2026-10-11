import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { Permission } from '@work-phelo/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RunReportDto } from './dto/run-report.dto';
import { SaveReportDto } from './dto/save-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = Request & { user: RequestUser };

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@RequirePermissions(Permission.VIEW_HR_REPORTS)
@ApiBearerAuth('access-token')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('catalog')
  @ApiOperation({
    summary: 'Datasets, fields and chart options the report builder can use',
  })
  @ApiResponse({ status: 200, description: 'Catalog returned' })
  getCatalog(@Req() req: AuthenticatedRequest) {
    return this.reportsService.getCatalog(req.user);
  }

  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run one table or chart block and return its data' })
  @ApiResponse({ status: 200, description: 'Report data returned' })
  @ApiResponse({ status: 400, description: 'Block does not fit the catalog' })
  run(@Req() req: AuthenticatedRequest, @Body() dto: RunReportDto) {
    return this.reportsService.run(req.user, dto);
  }

  @Get('saved')
  @ApiOperation({ summary: 'List saved reports (shared across the tenant)' })
  listSaved(@Req() req: AuthenticatedRequest) {
    return this.reportsService.listSaved(req.user.tenantId);
  }

  @Get('saved/:id')
  @ApiOperation({ summary: 'Get one saved report with its definition' })
  @ApiParam({ name: 'id', description: 'Saved report UUID' })
  getSaved(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reportsService.getSaved(req.user.tenantId, id);
  }

  @Post('saved')
  @ApiOperation({ summary: 'Save a report' })
  @ApiResponse({ status: 201, description: 'Report saved' })
  @ApiResponse({ status: 409, description: 'Name already in use' })
  createSaved(@Req() req: AuthenticatedRequest, @Body() dto: SaveReportDto) {
    return this.reportsService.createSaved(req.user, dto);
  }

  @Patch('saved/:id')
  @ApiOperation({ summary: 'Update a saved report (author or admin only)' })
  @ApiParam({ name: 'id', description: 'Saved report UUID' })
  updateSaved(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.updateSaved(req.user, id, dto);
  }

  @Delete('saved/:id')
  @ApiOperation({ summary: 'Delete a saved report (author or admin only)' })
  @ApiParam({ name: 'id', description: 'Saved report UUID' })
  deleteSaved(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reportsService.deleteSaved(req.user, id);
  }
}

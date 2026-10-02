import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { Permission } from '@work-phelo/config';
import { BulkImportService } from './bulk-import.service';
import { BulkImportCompanyDto } from './dto/bulk-import-company.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Bulk Import')
@Controller('bulk-import')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class BulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  @Post('company')
  @RequirePermissions(
    Permission.CREATE_BRANCH,
    Permission.CREATE_DEPARTMENT,
    Permission.CREATE_EMPLOYEE,
  )
  @ApiOperation({
    summary:
      'Bulk-create branches, departments and employees together from parsed import rows',
  })
  @ApiResponse({
    status: 201,
    description: 'Per-row import results, grouped by entity',
  })
  importCompany(
    @Body() dto: BulkImportCompanyDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.bulkImportService.importCompany(req.user.tenantId, dto);
  }
}

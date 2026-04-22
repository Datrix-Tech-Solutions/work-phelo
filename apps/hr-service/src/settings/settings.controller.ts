import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@work-phelo/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UpdateResignationSettingsDto } from './dto/update-resignation-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('resignation')
  @ApiOperation({
    summary: 'Get resignation settings for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Resignation settings retrieved' })
  getResignationSettings(@Req() req: any) {
    return this.settingsService.getResignationSettings(
      req.user.tenantId,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }

  @Patch('resignation')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Update resignation settings for the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Resignation settings updated' })
  updateResignationSettings(
    @Body() dto: UpdateResignationSettingsDto,
    @Req() req: any,
  ) {
    return this.settingsService.updateResignationSettings(
      req.user.tenantId,
      dto.resignationNoticePeriodDays,
      req.user.role === 'TENANT_ADMIN' ? req.user.id : null,
      req.user.role === 'TENANT_ADMIN' ? req.user.email : null,
    );
  }
}

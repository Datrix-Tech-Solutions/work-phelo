import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';

@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  @Get('users/:userId')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  getUserPermissions(@Param('userId') userId: string, @Req() req: any) {
    return this.permissionsService.getUserPermissions(
      req.user.tenantId,
      userId,
    );
  }

  @Post('grant')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  grantOrRevoke(@Body() dto: GrantPermissionDto, @Req() req: any) {
    return this.permissionsService.grantOrRevoke(
      req.user.id,
      req.user.tenantId,
      dto,
    );
  }

  @Delete('users/:userId/:permission')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  removeOverride(
    @Param('userId') userId: string,
    @Param('permission') permission: string,
    @Req() req: any,
  ) {
    return this.permissionsService.removeOverride(
      req.user.tenantId,
      userId,
      permission,
    );
  }
}

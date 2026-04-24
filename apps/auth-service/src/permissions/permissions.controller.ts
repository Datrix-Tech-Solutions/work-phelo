import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import {
  GrantPermissionDto,
  RevokePermissionDto,
  AssignPermissionSetDto,
  CreatePermissionSetDto,
  UpdatePermissionSetDto,
} from './dto/grant-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('resources')
  @RequirePermissions(Permission.VIEW_PERMISSION_SETS)
  @ApiOperation({ summary: 'List all platform resources' })
  @ApiResponse({ status: 200, description: 'Resources list retrieved' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  getAllResources() {
    return this.permissionsService.getAllResources();
  }

  @Get('users/:userId')
  @RequirePermissions(Permission.VIEW_PERMISSION_SETS)
  @ApiOperation({
    summary: 'Get effective permissions for a user — direct + from sets',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'Effective permissions retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserPermissions(@Param('userId') userId: string, @Req() req: any) {
    return this.permissionsService.getUserPermissions(
      req.user.tenantId,
      userId,
    );
  }

  @Get('users/:userId/history')
  @RequirePermissions(Permission.VIEW_PERMISSION_SETS)
  @ApiOperation({
    summary: 'Full permission history including revoked — useful for audit',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Permission history retrieved' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  getPermissionHistory(@Param('userId') userId: string, @Req() req: any) {
    return this.permissionsService.getPermissionHistory(
      req.user.tenantId,
      userId,
    );
  }

  @Post('grant')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  @ApiOperation({
    summary: 'Grant a direct permission to a user on a resource',
  })
  @ApiResponse({ status: 200, description: 'Permission granted' })
  @ApiResponse({
    status: 403,
    description: 'Cannot grant to SUPER_ADMIN or TENANT_ADMIN',
  })
  @ApiBody({
    description: 'Grant permission payload',
    schema: {
      example: {
        userId: 'replace-with-user-id',
        resourceId: 'replace-with-resource-id',
        action: 'VIEW',
        reason: 'Temporary access for leave audit',
      },
    },
  })
  grant(@Body() dto: GrantPermissionDto, @Req() req: any) {
    return this.permissionsService.grant(req.user.id, req.user.tenantId, dto);
  }

  @Patch('revoke')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  @ApiOperation({
    summary: 'Revoke a permission — soft update, row is never deleted',
  })
  @ApiResponse({ status: 200, description: 'Permission revoked' })
  @ApiBody({
    description: 'Revoke permission payload',
    schema: {
      example: {
        userId: 'replace-with-user-id',
        resourceId: 'replace-with-resource-id',
        action: 'VIEW',
        reason: 'Access no longer required',
      },
    },
  })
  revoke(@Body() dto: RevokePermissionDto, @Req() req: any) {
    return this.permissionsService.revoke(req.user.id, req.user.tenantId, dto);
  }

  @Get('sets')
  @RequirePermissions(Permission.VIEW_PERMISSION_SETS)
  @ApiOperation({ summary: 'List all permission sets in tenant' })
  @ApiResponse({ status: 200, description: 'Permission sets retrieved' })
  getPermissionSets(@Req() req: any) {
    return this.permissionsService.getPermissionSets(req.user.tenantId);
  }

  @Post('sets')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new permission set with resource-action pairs',
  })
  @ApiBody({
    description: 'Create permission set payload',
    schema: {
      example: {
        name: 'Leave Manager Set',
        description: 'Can view employees and approve leave requests',
        resources: [
          { resourceId: 'uuid', action: 'VIEW' },
          { resourceId: 'uuid', action: 'APPROVE' },
        ],
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Permission set created' })
  @ApiResponse({
    status: 400,
    description: 'Set name already exists or invalid resources',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  createSet(@Body() dto: CreatePermissionSetDto, @Req() req: any) {
    return this.permissionsService.createPermissionSet(req.user.tenantId, dto);
  }

  @Patch('sets/:id')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  @ApiOperation({
    summary:
      'Replace all resource-action pairs on a permission set — this is how the Permission Matrix saves',
  })
  @ApiParam({ name: 'id', description: 'Permission set UUID' })
  @ApiBody({
    description: 'Update permission set payload',
    schema: {
      example: {
        resources: [
          { resourceId: 'uuid', action: 'VIEW' },
          { resourceId: 'uuid', action: 'APPROVE' },
        ],
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Permission set updated' })
  @ApiResponse({ status: 400, description: 'Invalid resources' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Permission set not found' })
  updateSet(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionSetDto,
    @Req() req: any,
  ) {
    return this.permissionsService.updatePermissionSet(
      req.user.tenantId,
      id,
      dto,
    );
  }

  @Delete('sets/:id')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  @ApiOperation({ summary: 'Delete a custom permission set' })
  @ApiParam({ name: 'id', description: 'Permission set UUID' })
  @ApiResponse({ status: 200, description: 'Permission set deleted' })
  @ApiResponse({ status: 403, description: 'System sets cannot be deleted' })
  @ApiResponse({ status: 404, description: 'Permission set not found' })
  deleteSet(@Param('id') id: string, @Req() req: any) {
    return this.permissionsService.deletePermissionSet(req.user.tenantId, id);
  }

  @Post('sets/assign')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  @ApiOperation({ summary: 'Assign a permission set to a user' })
  @ApiBody({
    description: 'Assign permission set payload',
    schema: {
      example: {
        userId: 'replace-with-user-id',
        permissionSetId: 'replace-with-permission-set-id',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Permission set assigned' })
  assignSet(@Body() dto: AssignPermissionSetDto, @Req() req: any) {
    return this.permissionsService.assignPermissionSet(
      req.user.id,
      req.user.tenantId,
      dto,
    );
  }

  @Patch('sets/remove/:userId/:permissionSetId')
  @RequirePermissions(Permission.GRANT_PERMISSION)
  @ApiOperation({ summary: 'Remove a permission set from a user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiParam({ name: 'permissionSetId', description: 'Permission set UUID' })
  @ApiResponse({ status: 200, description: 'Permission set removed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'User or permission set not found' })
  removeSet(
    @Param('userId') userId: string,
    @Param('permissionSetId') permissionSetId: string,
    @Req() req: any,
  ) {
    return this.permissionsService.removePermissionSet(
      req.user.tenantId,
      userId,
      permissionSetId,
    );
  }
}

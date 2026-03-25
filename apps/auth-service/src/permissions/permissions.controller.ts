import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
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
} from './dto/grant-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('resources')
  @ApiOperation({ summary: 'List all platform resources' })
  @ApiResponse({ status: 200, description: 'Resources list retrieved' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  getAllResources() {
    return this.permissionsService.getAllResources();
  }

  @Get('users/:userId')
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
  @ApiOperation({ summary: 'List all permission sets in tenant' })
  @ApiResponse({ status: 200, description: 'Permission sets retrieved' })
  getPermissionSets(@Req() req: any) {
    return this.permissionsService.getPermissionSets(req.user.tenantId);
  }

  @Post('sets/assign')
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

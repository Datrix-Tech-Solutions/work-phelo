import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompanyRolesService } from './company-roles.service';
import { CreateCompanyRoleDto } from './dto/create-company-role.dto';
import { UpdateCompanyRoleDto } from './dto/update-company-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';

@ApiTags('Company Roles')
@Controller('company-roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
export class CompanyRolesController {
  constructor(private readonly companyRolesService: CompanyRolesService) {}

  @Get()
  @RequirePermissions(Permission.READ_COMPANY_ROLES)
  @ApiOperation({ summary: 'List company roles for current tenant' })
  @ApiResponse({ status: 200, description: 'Company roles retrieved' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findAll(@Req() req: any) {
    return this.companyRolesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_COMPANY_ROLES)
  @ApiOperation({ summary: 'Get company role by ID' })
  @ApiParam({ name: 'id', description: 'Company role UUID' })
  @ApiResponse({ status: 200, description: 'Company role retrieved' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Company role not found' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.companyRolesService.findById(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_COMPANY_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom company role' })
  @ApiBody({
    description: 'Create role payload',
    schema: {
      example: {
        name: 'Finance Reviewer',
        description: 'Can review payroll and finance reports',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Company role created' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Role name already exists' })
  create(@Body() dto: CreateCompanyRoleDto, @Req() req: any) {
    return this.companyRolesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_COMPANY_ROLES)
  @ApiOperation({ summary: 'Update company role details' })
  @ApiParam({ name: 'id', description: 'Company role UUID' })
  @ApiBody({
    description: 'Update role payload',
    schema: {
      example: {
        name: 'Operations Supervisor',
        description: 'Supervises attendance, leave, and schedules',
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Company role updated' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Company role not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyRoleDto,
    @Req() req: any,
  ) {
    return this.companyRolesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_COMPANY_ROLES)
  @ApiOperation({ summary: 'Delete company role' })
  @ApiParam({ name: 'id', description: 'Company role UUID' })
  @ApiResponse({ status: 200, description: 'Company role deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Company role not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete system role' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.companyRolesService.remove(req.user.tenantId, id);
  }

  @Patch(':id/assign/:userId')
  @RequirePermissions(Permission.ASSIGN_ROLE)
  @ApiOperation({ summary: 'Assign company role to a user' })
  @ApiParam({ name: 'id', description: 'Company role UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Role or user not found' })
  assignToUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.companyRolesService.assignRoleToUser(
      req.user.tenantId,
      userId,
      id,
    );
  }
}

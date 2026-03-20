import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
export class CompanyRolesController {
  constructor(private readonly companyRolesService: CompanyRolesService) {}

  @Get()
  @RequirePermissions(Permission.READ_COMPANY_ROLES)
  findAll(@Req() req: any) {
    return this.companyRolesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_COMPANY_ROLES)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.companyRolesService.findById(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_COMPANY_ROLES)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCompanyRoleDto, @Req() req: any) {
    return this.companyRolesService.create(req.user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_COMPANY_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyRoleDto,
    @Req() req: any,
  ) {
    return this.companyRolesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_COMPANY_ROLES)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.companyRolesService.remove(req.user.tenantId, id);
  }

  @Patch(':id/assign/:userId')
  @RequirePermissions(Permission.ASSIGN_ROLE)
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

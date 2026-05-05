import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@work-phelo/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CompanyAgreementsService } from './company-agreements.service';
import { CreateCompanyAgreementDto } from './dto/create-company-agreement.dto';

@ApiTags('Company Agreements')
@Controller('company-agreements')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class CompanyAgreementsController {
  constructor(
    private readonly companyAgreementsService: CompanyAgreementsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List company agreements for the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Company agreements retrieved successfully',
  })
  findAll(@Req() req: any) {
    return this.companyAgreementsService.findAll(req.user.tenantId);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Create a company agreement for the current tenant',
  })
  @ApiBody({ type: CreateCompanyAgreementDto })
  @ApiResponse({
    status: 201,
    description: 'Company agreement created successfully',
  })
  create(@Body() dto: CreateCompanyAgreementDto, @Req() req: any) {
    return this.companyAgreementsService.create(
      req.user.tenantId,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_HR_SETTINGS)
  @ApiOperation({
    summary: 'Delete a company agreement',
  })
  @ApiParam({ name: 'id', description: 'Company agreement UUID' })
  @ApiResponse({
    status: 200,
    description: 'Company agreement deleted successfully',
  })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.companyAgreementsService.remove(req.user.tenantId, id);
  }
}

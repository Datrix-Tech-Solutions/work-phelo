import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PayrollConfigurationService } from './payroll-configuration.service';
import { SavePayrollConfigurationDto } from './dto/save-payroll-configuration.dto';
import { SavePayrollSavedComponentDto } from './dto/save-payroll-saved-component.dto';

type AuthedRequest = Request & { user: RequestUser };

// Own route prefixes: the payroll controller's `payroll/:id` would swallow `payroll/configurations`.
@ApiTags('Payroll configuration')
@Controller('payroll-configurations')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'payroll')
@ApiBearerAuth('access-token')
export class PayrollConfigurationController {
  constructor(private readonly service: PayrollConfigurationService) {}

  @Get()
  @RequirePermissions(Permission.READ_PAYROLL)
  @ApiOperation({
    summary: 'List the payroll configurations with their versions',
  })
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.READ_PAYROLL)
  @ApiOperation({ summary: 'Get one payroll configuration with its versions' })
  @ApiParam({ name: 'id', description: 'Payroll configuration UUID' })
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.service.get(req.user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({
    summary: 'Create a payroll configuration with its first version',
  })
  @ApiResponse({ status: 400, description: 'The components are not valid' })
  create(@Body() dto: SavePayrollConfigurationDto, @Req() req: AuthedRequest) {
    return this.service.create(req.user.tenantId, req.user.id, dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({
    summary:
      'Save a payroll configuration. Changed components publish a new version',
  })
  @ApiParam({ name: 'id', description: 'Payroll configuration UUID' })
  @ApiResponse({ status: 409, description: 'A newer version was saved' })
  update(
    @Param('id') id: string,
    @Body() dto: SavePayrollConfigurationDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(req.user.tenantId, req.user.id, id, dto);
  }
}

@ApiTags('Payroll configuration')
@Controller('payroll-saved-components')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'payroll')
@ApiBearerAuth('access-token')
export class PayrollSavedComponentController {
  constructor(private readonly service: PayrollConfigurationService) {}

  @Get()
  @RequirePermissions(Permission.READ_PAYROLL)
  @ApiOperation({ summary: 'List the saved pay components' })
  list(@Req() req: AuthedRequest) {
    return this.service.listSavedComponents(req.user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({ summary: 'Save a pay component for reuse' })
  create(@Body() dto: SavePayrollSavedComponentDto, @Req() req: AuthedRequest) {
    return this.service.createSavedComponent(
      req.user.tenantId,
      req.user.id,
      dto,
    );
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({ summary: 'Replace a saved pay component' })
  @ApiParam({ name: 'id', description: 'Saved component UUID' })
  replace(
    @Param('id') id: string,
    @Body() dto: SavePayrollSavedComponentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.replaceSavedComponent(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({ summary: 'Delete a saved pay component' })
  @ApiParam({ name: 'id', description: 'Saved component UUID' })
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.service.deleteSavedComponent(req.user.tenantId, id);
  }
}

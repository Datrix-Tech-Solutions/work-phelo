import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
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
import { PayrollGroupsService } from './payroll-groups.service';
import { SavePayrollGroupDto } from './dto/save-payroll-group.dto';
import { SetGroupEmployeesDto } from './dto/set-group-employees.dto';

type AuthedRequest = Request & { user: RequestUser };

// Own prefix: the payroll controller's `payroll/:id` would swallow `payroll/groups`.
@ApiTags('Payroll groups')
@Controller('payroll-groups')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'payroll')
@ApiBearerAuth('access-token')
export class PayrollGroupsController {
  constructor(private readonly service: PayrollGroupsService) {}

  @Get()
  @RequirePermissions(Permission.READ_PAYROLL)
  @ApiOperation({ summary: 'List the payroll groups' })
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({ summary: 'Create a payroll group' })
  @ApiResponse({ status: 400, description: 'The group is not valid' })
  @ApiResponse({ status: 409, description: 'Another group has that name' })
  create(@Body() dto: SavePayrollGroupDto, @Req() req: AuthedRequest) {
    return this.service.create(req.user.tenantId, req.user.id, dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({ summary: 'Save changes to a payroll group' })
  @ApiParam({ name: 'id', description: 'Payroll group UUID' })
  update(
    @Param('id') id: string,
    @Body() dto: SavePayrollGroupDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Put(':id/employees')
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({
    summary: 'Set who is in a payroll group',
    description:
      'Replaces the group members with the listed employees, moving them out of any other group.',
  })
  @ApiParam({ name: 'id', description: 'Payroll group UUID' })
  @ApiResponse({
    status: 400,
    description: 'An employee is not paid the way the group pays',
  })
  setEmployees(
    @Param('id') id: string,
    @Body() dto: SetGroupEmployeesDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.setEmployees(req.user.tenantId, id, dto.employeeIds);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_PAYROLL_SETTINGS)
  @ApiOperation({ summary: 'Delete a payroll group' })
  @ApiParam({ name: 'id', description: 'Payroll group UUID' })
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.service.remove(req.user.tenantId, id);
  }
}

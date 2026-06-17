import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  EmployeeImportDryRunRequestDto,
  EmployeeImportDryRunResponseDto,
} from './dto/employee-import-dry-run.dto';
import { HrEmployeeImportsService } from './hr-employee-imports.service';

@ApiTags('Imports')
@Controller('imports/employees')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@ApiBearerAuth('access-token')
export class HrImportsController {
  constructor(private readonly importsService: HrEmployeeImportsService) {}

  @Post('dry-run')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CREATE_EMPLOYEE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Dry-run validate a CSV employee import without creating records',
    description:
      'Validates employee CSV rows for the current tenant. This endpoint never creates employees, auth users, leave balances, holidays, or invitation events.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: EmployeeImportDryRunRequestDto })
  @ApiResponse({
    status: 201,
    description: 'CSV validated and row-level results persisted',
    type: EmployeeImportDryRunResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid file, unsupported file type, invalid CSV, or file exceeds MVP limits',
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency key was already used for a different file',
  })
  dryRunEmployees(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: EmployeeImportDryRunRequestDto,
    @Req() req: Request & { user: RequestUser },
  ) {
    return this.importsService.dryRunEmployees(
      req.user.tenantId,
      req.user.id,
      file,
      dto.idempotencyKey,
    );
  }
}

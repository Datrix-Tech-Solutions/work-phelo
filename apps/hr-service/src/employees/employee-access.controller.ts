import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { RequestUser, EmployeeAccessPatterns } from '@work-phelo/types';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { PermissionExempt } from '../auth/decorators/permissions.decorator';
import { EmployeeAccessService } from './employee-access.service';
import { normalizeEmployeeEmail } from './employee-email';
import { EmployeeAccessRecoveryService } from './employee-access-recovery.service';
import { EmployeeAccessOperationStatus } from '../../prisma/generated/client';

export class QueryAccessOperationsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional()
  @IsEnum(EmployeeAccessOperationStatus)
  status?: EmployeeAccessOperationStatus;
  @IsOptional() @IsUUID() cursor?: string;
}

export class GrantEmployeeAccessDto {
  @Transform(({ value }) => normalizeEmployeeEmail(value))
  @IsOptional()
  @IsEmail()
  email?: string | null;
}

export class EmployeeAccessReasonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

@ApiTags('Employee system access')
@ApiBearerAuth()
@Controller('employees/:id/system-access')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@PermissionExempt(
  'service-policy',
  'EmployeeAccessService enforces tenant employee scope AND users lifecycle permission for every method.',
)
export class EmployeeAccessController {
  constructor(
    private readonly access: EmployeeAccessService,
    private readonly recovery: EmployeeAccessRecoveryService,
  ) {}
  @Get('operations/:operationId/recoveries')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.recovery.history(req.user.tenantId, id, operationId, req.user);
  }
  @Post('operations/:operationId/reconcile')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Req() req: { user: RequestUser },
    @Headers('idempotency-key') key: string,
    @Body() dto: EmployeeAccessReasonDto,
  ) {
    return this.recovery.reconcile(
      req.user.tenantId,
      id,
      operationId,
      req.user,
      key,
      dto.reason,
    );
  }
  @Post('suspend')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
    @Headers('idempotency-key') key: string,
    @Body() dto: EmployeeAccessReasonDto,
  ) {
    return this.access.lifecycle(
      req.user.tenantId,
      id,
      req.user,
      key,
      'SUSPEND',
      dto.reason,
    );
  }
  @Post('restore')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
    @Headers('idempotency-key') key: string,
    @Body() dto: EmployeeAccessReasonDto,
  ) {
    return this.access.lifecycle(
      req.user.tenantId,
      id,
      req.user,
      key,
      'RESTORE',
      dto.reason,
    );
  }
  @Post('grant')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  grant(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
    @Headers('idempotency-key') key: string,
    @Body() dto: GrantEmployeeAccessDto,
  ) {
    return this.access.grant(req.user.tenantId, id, req.user, key, dto.email);
  }
  @Get('operations/:operationId')
  operation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.access.readOperation(
      req.user.tenantId,
      id,
      operationId,
      req.user,
    );
  }
  @Get()
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.access.read(req.user.tenantId, id, req.user);
  }
}

@ApiTags('Employee system access')
@ApiBearerAuth()
@Controller('employee-access-operations')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('hr')
@PermissionExempt(
  'service-policy',
  'EmployeeAccessRecoveryService requires employees:VIEW AND users:VIEW.',
)
export class EmployeeAccessOperationsController {
  constructor(private readonly recovery: EmployeeAccessRecoveryService) {}
  @Get()
  list(
    @Req() req: { user: RequestUser },
    @Query() query: QueryAccessOperationsDto,
  ) {
    return this.recovery.list(
      req.user,
      query.limit,
      query.status,
      query.cursor,
    );
  }
}

@Controller()
export class EmployeeAccessLinkHandler {
  constructor(private readonly access: EmployeeAccessService) {}
  @MessagePattern(EmployeeAccessPatterns.offboarded)
  async offboarded(
    @Payload()
    envelope: Parameters<EmployeeAccessService['verifyOffboarded']>[0],
    @Ctx() context?: RmqContext,
  ) {
    try {
      return await this.access.verifyOffboarded(envelope);
    } catch {
      throw new RpcException({
        statusCode: 503,
        message: 'Offboarding state unavailable',
      });
    } finally {
      if (context) {
        const channel = context.getChannelRef() as {
          ack: (message: unknown) => void;
        };
        channel.ack(context.getMessage());
      }
    }
  }
  @MessagePattern(EmployeeAccessPatterns.verifyLink)
  async verify(
    @Payload() data: Parameters<EmployeeAccessService['verifyLink']>[0],
    @Ctx() context?: RmqContext,
  ) {
    try {
      return await this.access.verifyLink(data);
    } catch {
      throw new RpcException({
        statusCode: 503,
        message: 'Employee access link could not be confirmed',
      });
    } finally {
      if (context) {
        const channel = context.getChannelRef() as {
          ack: (message: unknown) => void;
        };
        channel.ack(context.getMessage());
      }
    }
  }
}

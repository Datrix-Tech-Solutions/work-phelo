import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ACCOUNTING_REFERENCE_READERS,
  AccountingPermission,
} from './accounting.permissions';
import {
  CreateEntityTypeDto,
  UpdateEntityTypeDto,
} from './dto/entity-types.dto';
import { EntityTypesService } from './entity-types.service';

@Controller('entity-types')
@ApiTags('Accounting - Entity Types')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class EntityTypesController {
  constructor(private readonly service: EntityTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant entity types' })
  @RequireAnyPermission(...ACCOUNTING_REFERENCE_READERS)
  list(@Req() request: Request & { user: RequestUser }) {
    return this.service.listEntityTypes(request.user);
  }

  @Post()
  @ApiOperation({ summary: 'Create an entity type' })
  @RequirePermissions(AccountingPermission.ENTITIES_CREATE)
  create(
    @Body() dto: CreateEntityTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.createEntityType(request.user, dto);
  }

  @Patch(':entityTypeId')
  @ApiOperation({ summary: 'Update an entity type' })
  @RequirePermissions(AccountingPermission.ENTITIES_EDIT)
  update(
    @Param('entityTypeId', ParseUUIDPipe) entityTypeId: string,
    @Body() dto: UpdateEntityTypeDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.updateEntityType(request.user, entityTypeId, dto);
  }

  @Delete(':entityTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an entity type' })
  @RequirePermissions(AccountingPermission.ENTITIES_DELETE)
  delete(
    @Param('entityTypeId', ParseUUIDPipe) entityTypeId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.deleteEntityType(request.user, entityTypeId);
  }
}

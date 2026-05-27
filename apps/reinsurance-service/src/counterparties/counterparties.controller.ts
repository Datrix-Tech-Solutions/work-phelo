import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CounterpartiesService } from './counterparties.service';
import { CounterpartyPermission } from './counterparty.permissions';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { QueryCounterpartiesDto } from './dto/query-counterparties.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

@Controller('counterparties')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class CounterpartiesController {
  constructor(private readonly counterpartiesService: CounterpartiesService) {}

  @Get()
  @RequirePermissions(CounterpartyPermission.VIEW)
  findAll(
    @Query() query: QueryCounterpartiesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.findAll(request.user.tenantId, query);
  }

  @Post()
  @RequirePermissions(CounterpartyPermission.CREATE)
  create(
    @Body() dto: CreateCounterpartyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.create(request.user, dto);
  }

  @Get(':id')
  @RequirePermissions(CounterpartyPermission.VIEW)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.findOne(request.user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(CounterpartyPermission.EDIT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCounterpartyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.update(request.user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(CounterpartyPermission.DELETE)
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.counterpartiesService.archive(request.user, id);
  }
}

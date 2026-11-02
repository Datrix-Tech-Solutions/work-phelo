import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ModuleGuard } from './auth/guards/module.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RequireModule } from './auth/decorators/module.decorator';
import { RequirePermissions } from './auth/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';
import {
  NameDto,
  UpdateNameDto,
  LocationDto,
  UpdateLocationDto,
  ItemDto,
  UpdateItemDto,
  StockInDto,
} from './inventory.dto';

type UserRequest = { user: RequestUser };

@ApiTags('Inventory - Categories')
@ApiBearerAuth('access-token')
@Controller('categories')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class CategoriesController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequirePermissions('operations.inventory.categories:VIEW')
  list(@Req() req: UserRequest) {
    return this.service.listCategory(req.user.tenantId);
  }
  @Post()
  @RequirePermissions('operations.inventory.categories:CREATE')
  create(@Req() req: UserRequest, @Body() dto: NameDto) {
    return this.service.createCategory(req.user.tenantId, dto);
  }
  @Get(':id')
  @RequirePermissions('operations.inventory.categories:VIEW')
  get(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCategory(req.user.tenantId, id);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.categories:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNameDto,
  ) {
    return this.service.updateCategory(req.user.tenantId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operations.inventory.categories:DELETE')
  delete(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCategory(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Units')
@ApiBearerAuth('access-token')
@Controller('units')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class UnitsController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequirePermissions('operations.inventory.units:VIEW')
  list(@Req() req: UserRequest) {
    return this.service.listUnit(req.user.tenantId);
  }
  @Post()
  @RequirePermissions('operations.inventory.units:CREATE')
  create(@Req() req: UserRequest, @Body() dto: NameDto) {
    return this.service.createUnit(req.user.tenantId, dto);
  }
  @Get(':id')
  @RequirePermissions('operations.inventory.units:VIEW')
  get(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUnit(req.user.tenantId, id);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.units:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNameDto,
  ) {
    return this.service.updateUnit(req.user.tenantId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operations.inventory.units:DELETE')
  delete(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteUnit(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Locations')
@ApiBearerAuth('access-token')
@Controller('locations')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class LocationsController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequirePermissions('operations.inventory.locations:VIEW')
  list(@Req() req: UserRequest) {
    return this.service.listLocation(req.user.tenantId);
  }
  @Post()
  @RequirePermissions('operations.inventory.locations:CREATE')
  create(@Req() req: UserRequest, @Body() dto: LocationDto) {
    return this.service.createLocation(req.user.tenantId, dto);
  }
  @Get(':id')
  @RequirePermissions('operations.inventory.locations:VIEW')
  get(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getLocation(req.user.tenantId, id);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.locations:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.service.updateLocation(req.user.tenantId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operations.inventory.locations:DELETE')
  delete(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteLocation(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Items')
@ApiBearerAuth('access-token')
@Controller('items')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class ItemsController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequirePermissions('operations.inventory.items:VIEW')
  list(@Req() req: UserRequest) {
    return this.service.listItems(req.user.tenantId);
  }
  @Get(':id')
  @RequirePermissions('operations.inventory.items:VIEW')
  get(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getItem(req.user.tenantId, id);
  }
  @Post()
  @RequirePermissions('operations.inventory.items:CREATE')
  create(@Req() req: UserRequest, @Body() dto: ItemDto) {
    return this.service.createItem(req.user.tenantId, dto);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.items:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.updateItem(req.user.tenantId, id, dto);
  }
}
@ApiTags('Inventory - Stock')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class StockController {
  constructor(private readonly service: InventoryService) {}
  @Post('stock-in')
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  receive(@Req() req: UserRequest, @Body() dto: StockInDto) {
    return this.service.stockIn(req.user.tenantId, req.user.id, dto);
  }
  @Get('stock-balances')
  @RequirePermissions('operations.inventory.items:VIEW')
  balances(@Req() req: UserRequest) {
    return this.service.balances(req.user.tenantId);
  }
  @Get('stock-movements')
  @RequirePermissions('operations.inventory.stock-in:VIEW')
  movements(@Req() req: UserRequest) {
    return this.service.movements(req.user.tenantId);
  }
}

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ModuleGuard } from './auth/guards/module.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RequireModule } from './auth/decorators/module.decorator';
import { RequireAnyPermission, RequirePermissions } from './auth/decorators/permissions.decorator';
import { StockMovementRequestKind, StockMovementType } from '../prisma/generated/client';
import { InventoryService } from './inventory.service';
import {
  CategoryDto,
  UpdateCategoryDto,
  UnitDto,
  UpdateUnitDto,
  LocationDto,
  UpdateLocationDto,
  ItemDto,
  BulkImportItemsDto,
  SupplierPaymentDto,
  RejectionDto,
  PurchaseInvoiceDto,
  StockInCorrectionDto,
  StockOutCorrectionDto,
  StockTransferCorrectionDto,
  StockAdjustmentCorrectionDto,
  UpdateItemDto,
  StockInDto,
  PurchaseOrderDto,
  ReceivePurchaseOrderDto,
  AssignVariantDto,
  StockInBatchDto,
  StockOutBatchDto,
  StockTransferBatchDto,
  StockAdjustmentBatchDto,
  StockOutDto,
  StockTransferDto,
  StockAdjustmentDto,
  StockBalanceQueryDto,
  StockLotQueryDto,
  PartyDto,
  UpdatePartyDto,
  PartyQueryDto,
  SubcategoryDto,
  UpdateSubcategoryDto,
  SubcategoryQueryDto,
  VariantDto,
  UpdateVariantDto,
  VariantQueryDto,
  AdjustmentReasonDto,
  UpdateAdjustmentReasonDto,
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
  create(@Req() req: UserRequest, @Body() dto: CategoryDto) {
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
    @Body() dto: UpdateCategoryDto,
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
  create(@Req() req: UserRequest, @Body() dto: UnitDto) {
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
    @Body() dto: UpdateUnitDto,
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
  @Post('bulk-import')
  @RequirePermissions('operations.inventory.items:CREATE')
  @ApiOperation({
    summary: 'Create items from spreadsheet rows',
    description:
      'Categories, subcategories and units of measure are matched by name and created when missing. Each row succeeds or fails on its own; an existing SKU is skipped.',
  })
  bulkImport(@Req() req: UserRequest, @Body() dto: BulkImportItemsDto) {
    return this.service.bulkImportItems(req.user.tenantId, dto);
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
  @Post('stock-in-batches')
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  receiveBatch(@Req() req: UserRequest, @Body() dto: StockInBatchDto) {
    return this.service.stockInBatch(req.user.tenantId, req.user.id, dto);
  }
  @Post('stock-out')
  @RequirePermissions('operations.inventory.stock-out:CREATE')
  issue(@Req() req: UserRequest, @Body() dto: StockOutDto) {
    return this.service.stockOut(req.user.tenantId, req.user.id, dto);
  }
  @Post('stock-out-batches')
  @RequirePermissions('operations.inventory.stock-out:CREATE')
  issueBatch(@Req() req: UserRequest, @Body() dto: StockOutBatchDto) {
    return this.service.stockOutBatch(req.user.tenantId, req.user.id, dto);
  }
  @Post('stock-transfers')
  @RequirePermissions('operations.inventory.transfers:CREATE')
  transfer(@Req() req: UserRequest, @Body() dto: StockTransferDto) {
    return this.service.transfer(req.user.tenantId, req.user.id, dto);
  }
  @Post('stock-transfer-batches')
  @RequirePermissions('operations.inventory.transfers:CREATE')
  transferBatch(@Req() req: UserRequest, @Body() dto: StockTransferBatchDto) {
    return this.service.transferBatch(req.user.tenantId, req.user.id, dto);
  }
  @Get('variant-balances')
  @RequirePermissions('operations.inventory.items:VIEW')
  variantBalances(@Req() req: UserRequest) {
    return this.service.variantBalances(req.user.tenantId);
  }
  @Post('variant-balances/assign')
  @RequirePermissions('operations.inventory.adjustments:CREATE')
  assignVariant(@Req() req: UserRequest, @Body() dto: AssignVariantDto) {
    return this.service.assignVariant(req.user.tenantId, req.user.id, dto);
  }
  @Get('stock-balances')
  @RequirePermissions('operations.inventory.items:VIEW')
  balances(@Req() req: UserRequest, @Query() query: StockBalanceQueryDto) {
    return this.service.balances(req.user.tenantId, query.status);
  }
  @Post('stock-adjustments')
  @RequirePermissions('operations.inventory.adjustments:CREATE')
  adjust(@Req() req: UserRequest, @Body() dto: StockAdjustmentDto) {
    return this.service.adjust(req.user.tenantId, req.user.id, dto);
  }
  @Post('stock-adjustment-batches')
  @RequirePermissions('operations.inventory.adjustments:CREATE')
  adjustBatch(@Req() req: UserRequest, @Body() dto: StockAdjustmentBatchDto) {
    return this.service.adjustBatch(req.user.tenantId, req.user.id, dto);
  }
  @Get('stock-lots')
  @RequireAnyPermission(
    'operations.inventory.items:VIEW',
    'operations.inventory.stock-in:VIEW',
    'operations.inventory.stock-out:VIEW',
  )
  lots(@Req() req: UserRequest, @Query() query: StockLotQueryDto) {
    return this.service.lots(req.user.tenantId, query.itemId);
  }
  @Get('stock-movements')
  @RequireAnyPermission(
    'operations.inventory.stock-in:VIEW',
    'operations.inventory.stock-out:VIEW',
    'operations.inventory.transfers:VIEW',
    'operations.inventory.adjustments:VIEW',
  )
  movements(@Req() req: UserRequest) {
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'TENANT_ADMIN') {
      return this.service.movements(req.user.tenantId);
    }
    const permissions = new Set(req.user.permissions);
    const types: StockMovementType[] = [];
    if (permissions.has('operations.inventory.stock-in:VIEW')) types.push('STOCK_IN');
    if (permissions.has('operations.inventory.stock-out:VIEW')) types.push('STOCK_OUT');
    if (permissions.has('operations.inventory.transfers:VIEW'))
      types.push('TRANSFER_OUT', 'TRANSFER_IN');
    if (permissions.has('operations.inventory.adjustments:VIEW'))
      types.push('ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE');
    return this.service.movements(req.user.tenantId, types);
  }
}

@ApiTags('Inventory - Customers and suppliers')
@ApiBearerAuth('access-token')
@Controller('parties')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class PartiesController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequireAnyPermission(
    'operations.inventory.parties:VIEW',
    'operations.inventory.stock-in:CREATE',
    'operations.inventory.stock-out:CREATE',
  )
  list(@Req() req: UserRequest, @Query() query: PartyQueryDto) {
    return this.service.listParties(req.user.tenantId, query.kind);
  }
  @Post()
  @RequirePermissions('operations.inventory.parties:CREATE')
  create(@Req() req: UserRequest, @Body() dto: PartyDto) {
    return this.service.createParty(req.user.tenantId, dto);
  }
  @Get(':id')
  @RequirePermissions('operations.inventory.parties:VIEW')
  get(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getParty(req.user.tenantId, id);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.parties:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.service.updateParty(req.user.tenantId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operations.inventory.parties:DELETE')
  delete(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteParty(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Subcategories')
@ApiBearerAuth('access-token')
@Controller('subcategories')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class SubcategoriesController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequireAnyPermission('operations.inventory.categories:VIEW', 'operations.inventory.items:VIEW')
  list(@Req() req: UserRequest, @Query() query: SubcategoryQueryDto) {
    return this.service.listSubcategories(req.user.tenantId, query.categoryId);
  }
  @Post()
  @RequirePermissions('operations.inventory.categories:CREATE')
  create(@Req() req: UserRequest, @Body() dto: SubcategoryDto) {
    return this.service.createSubcategory(req.user.tenantId, dto);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.categories:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.service.updateSubcategory(req.user.tenantId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operations.inventory.categories:DELETE')
  delete(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteSubcategory(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Item variants')
@ApiBearerAuth('access-token')
@Controller('variants')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class VariantsController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequirePermissions('operations.inventory.items:VIEW')
  list(@Req() req: UserRequest, @Query() query: VariantQueryDto) {
    return this.service.listVariants(req.user.tenantId, query.itemId);
  }
  @Post()
  @RequirePermissions('operations.inventory.items:CREATE')
  create(@Req() req: UserRequest, @Body() dto: VariantDto) {
    return this.service.createVariant(req.user.tenantId, dto);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.items:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.service.updateVariant(req.user.tenantId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operations.inventory.items:EDIT')
  delete(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteVariant(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Adjustment reasons')
@ApiBearerAuth('access-token')
@Controller('adjustment-reasons')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class AdjustmentReasonsController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequireAnyPermission(
    'operations.inventory.adjustments:VIEW',
    'operations.inventory.adjustments:CREATE',
  )
  list(@Req() req: UserRequest) {
    return this.service.listReasons(req.user.tenantId);
  }
  @Post()
  @RequirePermissions('operations.inventory.adjustments:CREATE')
  create(@Req() req: UserRequest, @Body() dto: AdjustmentReasonDto) {
    return this.service.createReason(req.user.tenantId, dto);
  }
  @Patch(':id')
  @RequirePermissions('operations.inventory.adjustments:EDIT')
  update(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdjustmentReasonDto,
  ) {
    return this.service.updateReason(req.user.tenantId, id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('operations.inventory.adjustments:DELETE')
  delete(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteReason(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Purchase orders')
@ApiBearerAuth('access-token')
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class PurchaseOrdersController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequirePermissions('operations.inventory.stock-in:VIEW')
  list(@Req() req: UserRequest) {
    return this.service.listPurchaseOrders(req.user.tenantId);
  }
  @Get(':id')
  @RequirePermissions('operations.inventory.stock-in:VIEW')
  get(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPurchaseOrder(req.user.tenantId, id);
  }
  @Post()
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  create(@Req() req: UserRequest, @Body() dto: PurchaseOrderDto) {
    return this.service.createPurchaseOrder(req.user.tenantId, req.user.id, dto);
  }
  @Post(':id/invoices')
  @HttpCode(201)
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  invoice(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PurchaseInvoiceDto,
  ) {
    return this.service.recordPurchaseInvoice(req.user.tenantId, req.user.id, id, dto);
  }
  @Post(':id/receive')
  @HttpCode(201)
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  receive(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.service.receivePurchaseOrder(req.user.tenantId, req.user.id, id, dto);
  }
  // Approving needs the resource's EDIT permission, which keeps it apart from placing an order.
  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('operations.inventory.stock-in:EDIT')
  approve(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.approvePurchaseOrder(req.user.tenantId, req.user.id, id);
  }
  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('operations.inventory.stock-in:EDIT')
  reject(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectionDto,
  ) {
    return this.service.rejectPurchaseOrder(req.user.tenantId, req.user.id, id, dto.reason);
  }
  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  cancel(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancelPurchaseOrder(req.user.tenantId, id);
  }
  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  close(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.closePurchaseOrder(req.user.tenantId, id);
  }
}

@ApiTags('Inventory - Purchase orders')
@ApiBearerAuth('access-token')
@Controller('supplier-payments')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class SupplierPaymentsController {
  constructor(private readonly service: InventoryService) {}
  @Post()
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  create(@Req() req: UserRequest, @Body() dto: SupplierPaymentDto) {
    return this.service.createSupplierPayment(req.user.tenantId, req.user.id, dto);
  }
}

const REQUEST_RESOURCE: Record<StockMovementRequestKind, string> = {
  STOCK_IN: 'operations.inventory.stock-in',
  STOCK_OUT: 'operations.inventory.stock-out',
  TRANSFER: 'operations.inventory.transfers',
  ADJUSTMENT: 'operations.inventory.adjustments',
};

const isAdmin = (user: RequestUser) => user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN';
const can = (user: RequestUser, permission: string) =>
  isAdmin(user) || new Set(user.permissions).has(permission);

@ApiTags('Inventory - Stock movement approvals')
@ApiBearerAuth('access-token')
@Controller('stock-movement-requests')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class StockMovementRequestsController {
  constructor(private readonly service: InventoryService) {}
  @Get()
  @RequireAnyPermission(
    'operations.inventory.stock-in:VIEW',
    'operations.inventory.stock-out:VIEW',
    'operations.inventory.transfers:VIEW',
    'operations.inventory.adjustments:VIEW',
  )
  list(@Req() req: UserRequest) {
    const kinds = (Object.keys(REQUEST_RESOURCE) as StockMovementRequestKind[]).filter((k) =>
      can(req.user, `${REQUEST_RESOURCE[k]}:VIEW`),
    );
    return this.service.listMovementRequests(
      req.user.tenantId,
      isAdmin(req.user) ? undefined : kinds,
    );
  }
  @Post('stock-in')
  @RequirePermissions('operations.inventory.stock-in:CREATE')
  stockIn(@Req() req: UserRequest, @Body() dto: StockInBatchDto) {
    return this.service.submitMovementRequest(req.user.tenantId, req.user.id, 'STOCK_IN', dto);
  }
  @Post('stock-out')
  @RequirePermissions('operations.inventory.stock-out:CREATE')
  stockOut(@Req() req: UserRequest, @Body() dto: StockOutBatchDto) {
    return this.service.submitMovementRequest(req.user.tenantId, req.user.id, 'STOCK_OUT', dto);
  }
  @Post('transfer')
  @RequirePermissions('operations.inventory.transfers:CREATE')
  transfer(@Req() req: UserRequest, @Body() dto: StockTransferBatchDto) {
    return this.service.submitMovementRequest(req.user.tenantId, req.user.id, 'TRANSFER', dto);
  }
  @Post('adjustment')
  @RequirePermissions('operations.inventory.adjustments:CREATE')
  adjustment(@Req() req: UserRequest, @Body() dto: StockAdjustmentBatchDto) {
    return this.service.submitMovementRequest(req.user.tenantId, req.user.id, 'ADJUSTMENT', dto);
  }
  // Approving needs the EDIT permission of the kind of movement, apart from creating one.
  private async requireApprover(req: UserRequest, id: string) {
    const request = await this.service.getMovementRequest(req.user.tenantId, id);
    if (!can(req.user, `${REQUEST_RESOURCE[request.kind]}:EDIT`))
      throw new ForbiddenException('You do not have permission to approve this');
  }
  @Post(':id/approve')
  @HttpCode(200)
  @RequireAnyPermission(
    'operations.inventory.stock-in:EDIT',
    'operations.inventory.stock-out:EDIT',
    'operations.inventory.transfers:EDIT',
    'operations.inventory.adjustments:EDIT',
  )
  async approve(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    await this.requireApprover(req, id);
    return this.service.approveMovementRequest(req.user.tenantId, req.user.id, id);
  }
  @Post(':id/reject')
  @HttpCode(200)
  @RequireAnyPermission(
    'operations.inventory.stock-in:EDIT',
    'operations.inventory.stock-out:EDIT',
    'operations.inventory.transfers:EDIT',
    'operations.inventory.adjustments:EDIT',
  )
  async reject(
    @Req() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectionDto,
  ) {
    await this.requireApprover(req, id);
    return this.service.rejectMovementRequest(req.user.tenantId, req.user.id, id, dto.reason);
  }
}

const CHANGE_PERMISSIONS = Object.values(REQUEST_RESOURCE).flatMap((r) => [
  `${r}:EDIT`,
  `${r}:DELETE`,
]);

@ApiTags('Inventory - Stock movement corrections')
@ApiBearerAuth('access-token')
@Controller('stock-corrections')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('operations')
export class StockCorrectionsController {
  constructor(private readonly service: InventoryService) {}
  // Changing a posted movement needs EDIT on its kind (cancel, reverse) or DELETE (delete).
  private async require(req: UserRequest, key: string, action: 'EDIT' | 'DELETE') {
    const type = await this.service.movementType(req.user.tenantId, key);
    const kind: StockMovementRequestKind =
      type === 'STOCK_IN' || type === 'STOCK_OUT'
        ? type
        : type === 'TRANSFER_IN' || type === 'TRANSFER_OUT'
          ? 'TRANSFER'
          : 'ADJUSTMENT';
    if (!can(req.user, `${REQUEST_RESOURCE[kind]}:${action}`))
      throw new ForbiddenException('You do not have permission to change this movement');
  }
  private async correct(
    req: UserRequest,
    dto: { movementId: string; state: 'CANCELLED' | 'DELETED' },
    kind: StockMovementRequestKind,
    body: Parameters<InventoryService['correctMovement']>[5],
  ) {
    await this.require(req, dto.movementId, dto.state === 'DELETED' ? 'DELETE' : 'EDIT');
    return this.service.correctMovement(
      req.user.tenantId,
      req.user.id,
      dto.movementId,
      dto.state,
      kind,
      body,
    );
  }
  @Post(':id/reverse')
  @HttpCode(200)
  @RequireAnyPermission(...CHANGE_PERMISSIONS)
  async reverse(@Req() req: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    await this.require(req, id, 'EDIT');
    return this.service.reverseMovement(req.user.tenantId, req.user.id, id);
  }
  // The counter movement for a stock in is a stock out, and so on; each route takes its body.
  @Post('stock-in')
  @RequireAnyPermission(...CHANGE_PERMISSIONS)
  stockIn(@Req() req: UserRequest, @Body() dto: StockInCorrectionDto) {
    return this.correct(req, dto, 'STOCK_IN', dto.body);
  }
  @Post('stock-out')
  @RequireAnyPermission(...CHANGE_PERMISSIONS)
  stockOut(@Req() req: UserRequest, @Body() dto: StockOutCorrectionDto) {
    return this.correct(req, dto, 'STOCK_OUT', dto.body);
  }
  @Post('transfer')
  @RequireAnyPermission(...CHANGE_PERMISSIONS)
  transfer(@Req() req: UserRequest, @Body() dto: StockTransferCorrectionDto) {
    return this.correct(req, dto, 'TRANSFER', dto.body);
  }
  @Post('adjustment')
  @RequireAnyPermission(...CHANGE_PERMISSIONS)
  adjustment(@Req() req: UserRequest, @Body() dto: StockAdjustmentCorrectionDto) {
    return this.correct(req, dto, 'ADJUSTMENT', dto.body);
  }
}

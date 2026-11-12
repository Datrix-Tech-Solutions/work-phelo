import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import {
  CategoriesController,
  UnitsController,
  LocationsController,
  ItemsController,
  StockController,
  PurchaseOrdersController,
  SupplierPaymentsController,
  StockMovementRequestsController,
  PartiesController,
  SubcategoriesController,
  VariantsController,
  AdjustmentReasonsController,
} from './inventory.controller';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, InventoryService],
  controllers: [
    CategoriesController,
    UnitsController,
    LocationsController,
    ItemsController,
    StockController,
    PurchaseOrdersController,
    SupplierPaymentsController,
    StockMovementRequestsController,
    PartiesController,
    SubcategoriesController,
    VariantsController,
    AdjustmentReasonsController,
  ],
})
export class InventoryModule {}

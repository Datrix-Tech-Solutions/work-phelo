import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { AccountingModule } from './accounting/accounting.module';
import { InternalAccountingEventsController } from './internal-accounting-events.controller';
import {
  CategoriesController,
  UnitsController,
  LocationsController,
  ItemsController,
  StockController,
  PurchaseOrdersController,
  SupplierPaymentsController,
  StockMovementRequestsController,
  StockCorrectionsController,
  PartiesController,
  SubcategoriesController,
  VariantsController,
  AdjustmentReasonsController,
} from './inventory.controller';

@Module({
  imports: [AuthModule, AccountingModule],
  providers: [PrismaService, InventoryService],
  controllers: [
    InternalAccountingEventsController,
    CategoriesController,
    UnitsController,
    LocationsController,
    ItemsController,
    StockController,
    PurchaseOrdersController,
    SupplierPaymentsController,
    StockMovementRequestsController,
    StockCorrectionsController,
    PartiesController,
    SubcategoriesController,
    VariantsController,
    AdjustmentReasonsController,
  ],
})
export class InventoryModule {}

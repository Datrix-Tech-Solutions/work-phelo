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
  ],
})
export class InventoryModule {}

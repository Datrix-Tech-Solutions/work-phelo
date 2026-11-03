import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, StockMovementType } from '../prisma/generated/client';
import { PrismaService } from './prisma/prisma.service';
import {
  ItemDto,
  UpdateItemDto,
  LocationDto,
  UpdateLocationDto,
  CategoryDto,
  UpdateCategoryDto,
  UnitDto,
  UpdateUnitDto,
  StockInDto,
  StockOutDto,
  StockTransferDto,
  StockAdjustmentDto,
  StockAdjustmentType,
  StockBalanceStatus,
} from './inventory.dto';

// Two Decimal(18,4) inputs can produce 36 significant digits.
const StockDecimal = Prisma.Decimal.clone({ precision: 40 });

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Name, SKU or location code already exists in this company');
        if (error.code === 'P2003')
          throw new ConflictException('Record is referenced by inventory records');
        if (error.code === 'P2025') throw new NotFoundException('Inventory record not found');
        if (['P2020', 'P2000', 'P2033'].includes(error.code))
          throw new BadRequestException('Inventory numeric or text value exceeds supported limits');
      }
      throw error;
    }
  }

  async listCategory(tenantId: string) {
    const rows = await this.prisma.inventoryCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { items: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(({ _count, ...row }) => ({ ...row, itemCount: _count.items }));
  }
  async getCategory(tenantId: string, id: string) {
    const record = await this.prisma.inventoryCategory.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { items: true } } },
    });
    if (!record) throw new NotFoundException('Inventory record not found');
    const { _count, ...row } = record;
    return { ...row, itemCount: _count.items };
  }
  createCategory(tenantId: string, dto: CategoryDto) {
    return this.write(() => this.prisma.inventoryCategory.create({ data: { ...dto, tenantId } }));
  }
  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    await this.getCategory(tenantId, id);
    return this.write(() =>
      this.prisma.inventoryCategory.update({ where: { tenantId_id: { tenantId, id } }, data: dto }),
    );
  }
  async deleteCategory(tenantId: string, id: string) {
    await this.getCategory(tenantId, id);
    await this.write(() =>
      this.prisma.inventoryCategory.delete({ where: { tenantId_id: { tenantId, id } } }),
    );
  }

  listUnit(tenantId: string) {
    return this.prisma.unitOfMeasure.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
  async getUnit(tenantId: string, id: string) {
    const record = await this.prisma.unitOfMeasure.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Inventory record not found');
    return record;
  }
  createUnit(tenantId: string, dto: UnitDto) {
    const id = randomUUID();
    return this.write(() =>
      this.prisma.unitOfMeasure.create({
        data: { ...dto, id, tenantId, symbol: dto.symbol ?? id.slice(0, 10) },
      }),
    );
  }
  async updateUnit(tenantId: string, id: string, dto: UpdateUnitDto) {
    await this.getUnit(tenantId, id);
    return this.write(() =>
      this.prisma.unitOfMeasure.update({ where: { tenantId_id: { tenantId, id } }, data: dto }),
    );
  }
  async deleteUnit(tenantId: string, id: string) {
    await this.getUnit(tenantId, id);
    await this.write(() =>
      this.prisma.unitOfMeasure.delete({ where: { tenantId_id: { tenantId, id } } }),
    );
  }

  async listLocation(tenantId: string) {
    const rows = await this.prisma.stockLocation.findMany({
      where: { tenantId },
      include: { _count: { select: { balances: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    // One balance per tenant/item/location makes this a distinct item count, including zero.
    return rows.map(({ _count, ...row }) => ({ ...row, itemCount: _count.balances }));
  }
  async getLocation(tenantId: string, id: string) {
    const record = await this.prisma.stockLocation.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { balances: true } } },
    });
    if (!record) throw new NotFoundException('Inventory record not found');
    const { _count, ...row } = record;
    return { ...row, itemCount: _count.balances };
  }
  createLocation(tenantId: string, dto: LocationDto) {
    const id = randomUUID();
    return this.write(() =>
      this.prisma.stockLocation.create({
        data: {
          ...dto,
          id,
          tenantId,
          code: dto.code?.trim().toUpperCase() ?? 'LOC-' + id.toUpperCase(),
          type: dto.type ?? 'WAREHOUSE',
        },
      }),
    );
  }
  async updateLocation(tenantId: string, id: string, dto: UpdateLocationDto) {
    await this.getLocation(tenantId, id);
    return this.write(() =>
      this.prisma.stockLocation.update({
        where: { tenantId_id: { tenantId, id } },
        data: { ...dto, code: dto.code?.trim().toUpperCase() },
      }),
    );
  }
  async deleteLocation(tenantId: string, id: string) {
    await this.getLocation(tenantId, id);
    await this.write(() =>
      this.prisma.stockLocation.delete({ where: { tenantId_id: { tenantId, id } } }),
    );
  }

  listItems(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
  async getItem(tenantId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }
  private async references(
    tx: Prisma.TransactionClient,
    tenantId: string,
    dto: { categoryId?: string; unitOfMeasureId?: string },
  ) {
    if (dto.categoryId) {
      const category = await tx.inventoryCategory.findFirst({
        where: { tenantId, id: dto.categoryId },
        select: { id: true, status: true },
      });
      if (!category) throw new NotFoundException('Category not found');
      if (category.status !== 'ACTIVE') throw new ConflictException('Category is inactive');
    }
    if (dto.unitOfMeasureId) {
      const unit = await tx.unitOfMeasure.findFirst({
        where: { tenantId, id: dto.unitOfMeasureId },
        select: { id: true, status: true },
      });
      if (!unit) throw new NotFoundException('Unit of measure not found');
      if (unit.status !== 'ACTIVE') throw new ConflictException('Unit of measure is inactive');
    }
  }
  createItem(tenantId: string, dto: ItemDto) {
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        await this.references(tx, tenantId, dto);
        return tx.inventoryItem.create({ data: { ...dto, tenantId } });
      }),
    );
  }
  private async lockItem(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    // All stock mutations and UOM edits lock the item first, in the same order.
    await tx.$queryRaw`SELECT "id" FROM "inventory"."InventoryItem" WHERE "tenantId" = ${tenantId} AND "id" = ${id} FOR UPDATE`;
    const item = await tx.inventoryItem.findFirst({ where: { tenantId, id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }
  updateItem(tenantId: string, id: string, dto: UpdateItemDto) {
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const item = await this.lockItem(tx, tenantId, id);
        await this.references(tx, tenantId, {
          categoryId: dto.categoryId !== item.categoryId ? dto.categoryId : undefined,
          unitOfMeasureId:
            dto.unitOfMeasureId !== item.unitOfMeasureId ? dto.unitOfMeasureId : undefined,
        });
        if (
          dto.unitOfMeasureId &&
          dto.unitOfMeasureId !== item.unitOfMeasureId &&
          (await tx.stockBalance.findFirst({
            where: { tenantId, itemId: id },
            select: { id: true },
          }))
        ) {
          throw new ConflictException(
            'Unit cannot change after stock has been recorded; unit conversion is not supported',
          );
        }
        return tx.inventoryItem.update({ where: { tenantId_id: { tenantId, id } }, data: dto });
      }),
    );
  }
  stockIn(tenantId: string, userId: string, dto: StockInDto) {
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const item = await this.lockItem(tx, tenantId, dto.itemId);
        if (item.status !== 'ACTIVE')
          throw new ConflictException('Inactive items cannot receive stock');
        const location = await tx.stockLocation.findFirst({
          where: { tenantId, id: dto.locationId },
          select: { id: true, status: true },
        });
        if (!location) throw new NotFoundException('Stock location not found');
        if (location.status !== 'ACTIVE') throw new ConflictException('Stock location is inactive');
        const unitCost = dto.unitCost == null ? null : new StockDecimal(dto.unitCost);
        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            itemId: item.id,
            locationId: location.id,
            unitOfMeasureId: item.unitOfMeasureId,
            type: 'STOCK_IN',
            quantity,
            unitCost,
            totalCost: unitCost === null ? null : quantity.mul(unitCost),
            date: new Date(dto.dateReceived),
            source: dto.source,
            supplier: dto.supplier,
            reference: dto.reference,
            notes: dto.notes,
            createdBy: userId,
          },
        });
        const balance = await tx.stockBalance.upsert({
          where: {
            tenantId_itemId_locationId: { tenantId, itemId: item.id, locationId: location.id },
          },
          create: { tenantId, itemId: item.id, locationId: location.id, quantity },
          update: { quantity: { increment: quantity } },
        });
        return { movement, balance };
      }),
    );
  }
  private async requireLocations(tx: Prisma.TransactionClient, tenantId: string, ids: string[]) {
    const rows = await tx.stockLocation.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, status: true },
    });
    if (rows.length !== ids.length) throw new NotFoundException('Stock location not found');
    if (rows.some((row) => row.status !== 'ACTIVE'))
      throw new ConflictException('Stock location is inactive');
  }
  private async sourceBalance(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    locationId: string,
    quantity: Prisma.Decimal,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "inventory"."StockBalance" WHERE "tenantId" = ${tenantId} AND "itemId" = ${itemId} AND "locationId" = ${locationId} FOR UPDATE`;
    const balance = await tx.stockBalance.findUnique({
      where: { tenantId_itemId_locationId: { tenantId, itemId, locationId } },
    });
    if (!balance || balance.quantity.lt(quantity))
      throw new ConflictException('Insufficient stock');
    return balance;
  }
  stockOut(tenantId: string, userId: string, dto: StockOutDto) {
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const item = await this.lockItem(tx, tenantId, dto.itemId);
        if (item.status !== 'ACTIVE')
          throw new ConflictException('Inactive items cannot issue stock');
        await this.requireLocations(tx, tenantId, [dto.locationId]);
        await this.sourceBalance(tx, tenantId, item.id, dto.locationId, quantity);
        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            itemId: item.id,
            locationId: dto.locationId,
            unitOfMeasureId: item.unitOfMeasureId,
            type: 'STOCK_OUT',
            quantity,
            unitCost: null,
            totalCost: null,
            date: new Date(dto.date),
            purpose: dto.purpose,
            recipient: dto.recipient,
            reference: dto.reference,
            notes: dto.notes,
            createdBy: userId,
          },
        });
        const balance = await tx.stockBalance.update({
          where: {
            tenantId_itemId_locationId: { tenantId, itemId: item.id, locationId: dto.locationId },
          },
          data: { quantity: { decrement: quantity } },
        });
        return { movement, balance };
      }),
    );
  }
  transfer(tenantId: string, userId: string, dto: StockTransferDto) {
    if (dto.sourceLocationId === dto.destinationLocationId)
      throw new BadRequestException('Source and destination must differ');
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const item = await this.lockItem(tx, tenantId, dto.itemId);
        if (item.status !== 'ACTIVE')
          throw new ConflictException('Inactive items cannot transfer stock');
        await this.requireLocations(tx, tenantId, [
          dto.sourceLocationId,
          dto.destinationLocationId,
        ]);
        await this.sourceBalance(tx, tenantId, item.id, dto.sourceLocationId, quantity);
        const sourceBalance = await tx.stockBalance.update({
          where: {
            tenantId_itemId_locationId: {
              tenantId,
              itemId: item.id,
              locationId: dto.sourceLocationId,
            },
          },
          data: { quantity: { decrement: quantity } },
        });
        const destinationBalance = await tx.stockBalance.upsert({
          where: {
            tenantId_itemId_locationId: {
              tenantId,
              itemId: item.id,
              locationId: dto.destinationLocationId,
            },
          },
          create: { tenantId, itemId: item.id, locationId: dto.destinationLocationId, quantity },
          update: { quantity: { increment: quantity } },
        });
        const transferId = randomUUID();
        const data = {
          tenantId,
          itemId: item.id,
          unitOfMeasureId: item.unitOfMeasureId,
          quantity,
          unitCost: null,
          totalCost: null,
          transferId,
          date: new Date(dto.date),
          reference: dto.reference,
          notes: dto.notes,
          createdBy: userId,
        };
        const out = await tx.stockMovement.create({
          data: { ...data, type: 'TRANSFER_OUT', locationId: dto.sourceLocationId },
        });
        const incoming = await tx.stockMovement.create({
          data: { ...data, type: 'TRANSFER_IN', locationId: dto.destinationLocationId },
        });
        return { transferId, movements: [out, incoming], sourceBalance, destinationBalance };
      }),
    );
  }
  adjust(tenantId: string, userId: string, dto: StockAdjustmentDto) {
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    const decrease = dto.type === StockAdjustmentType.DECREASE;
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const item = await this.lockItem(tx, tenantId, dto.itemId);
        if (item.status !== 'ACTIVE')
          throw new ConflictException('Inactive items cannot adjust stock');
        await this.requireLocations(tx, tenantId, [dto.locationId]);
        if (decrease) await this.sourceBalance(tx, tenantId, item.id, dto.locationId, quantity);
        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            itemId: item.id,
            locationId: dto.locationId,
            unitOfMeasureId: item.unitOfMeasureId,
            type: decrease ? 'ADJUSTMENT_DECREASE' : 'ADJUSTMENT_INCREASE',
            quantity,
            adjustmentReason: dto.reason,
            date: new Date(dto.date),
            reference: dto.reference,
            notes: dto.notes,
            createdBy: userId,
            unitCost: null,
            totalCost: null,
          },
        });
        const where = {
          tenantId_itemId_locationId: { tenantId, itemId: item.id, locationId: dto.locationId },
        };
        const balance = decrease
          ? await tx.stockBalance.update({ where, data: { quantity: { decrement: quantity } } })
          : await tx.stockBalance.upsert({
              where,
              create: { tenantId, itemId: item.id, locationId: dto.locationId, quantity },
              update: { quantity: { increment: quantity } },
            });
        return { movement, balance };
      }),
    );
  }
  async balances(tenantId: string, status?: StockBalanceStatus) {
    const rows = await this.prisma.stockBalance.findMany({
      where: { tenantId },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            reorderLevel: true,
            unitOfMeasureId: true,
            unitOfMeasure: { select: { id: true, name: true } },
          },
        },
        location: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ itemId: 'asc' }, { locationId: 'asc' }],
    });
    const balances = rows.map(({ item, ...row }) => ({
      ...row,
      item,
      reorderLevel: item.reorderLevel,
      unitOfMeasure: item.unitOfMeasure,
      isLowStock: item.reorderLevel !== null && row.quantity.lte(item.reorderLevel),
      isOutOfStock: row.quantity.isZero(),
    }));
    if (status === StockBalanceStatus.LOW_STOCK) return balances.filter((row) => row.isLowStock);
    if (status === StockBalanceStatus.OUT_OF_STOCK)
      return balances.filter((row) => row.isOutOfStock);
    return balances;
  }
  movements(tenantId: string, types?: StockMovementType[]) {
    return this.prisma.stockMovement.findMany({
      where: { tenantId, ...(types ? { type: { in: types } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}

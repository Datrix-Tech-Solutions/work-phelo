import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from './prisma/prisma.service';
import {
  ItemDto,
  UpdateItemDto,
  LocationDto,
  UpdateLocationDto,
  NameDto,
  UpdateNameDto,
  StockInDto,
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
          throw new ConflictException('Name or SKU already exists in this company');
        if (error.code === 'P2003')
          throw new ConflictException('Record is referenced by inventory records');
        if (error.code === 'P2025') throw new NotFoundException('Inventory record not found');
        if (['P2020', 'P2000', 'P2033'].includes(error.code))
          throw new BadRequestException('Inventory numeric or text value exceeds supported limits');
      }
      throw error;
    }
  }

  listCategory(tenantId: string) {
    return this.prisma.inventoryCategory.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
  async getCategory(tenantId: string, id: string) {
    const record = await this.prisma.inventoryCategory.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Inventory record not found');
    return record;
  }
  createCategory(tenantId: string, dto: NameDto) {
    return this.write(() => this.prisma.inventoryCategory.create({ data: { ...dto, tenantId } }));
  }
  async updateCategory(tenantId: string, id: string, dto: UpdateNameDto) {
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
  createUnit(tenantId: string, dto: NameDto) {
    return this.write(() => this.prisma.unitOfMeasure.create({ data: { ...dto, tenantId } }));
  }
  async updateUnit(tenantId: string, id: string, dto: UpdateNameDto) {
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

  listLocation(tenantId: string) {
    return this.prisma.stockLocation.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
  async getLocation(tenantId: string, id: string) {
    const record = await this.prisma.stockLocation.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Inventory record not found');
    return record;
  }
  createLocation(tenantId: string, dto: LocationDto) {
    return this.write(() => this.prisma.stockLocation.create({ data: { ...dto, tenantId } }));
  }
  async updateLocation(tenantId: string, id: string, dto: UpdateLocationDto) {
    await this.getLocation(tenantId, id);
    return this.write(() =>
      this.prisma.stockLocation.update({ where: { tenantId_id: { tenantId, id } }, data: dto }),
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
    if (
      dto.categoryId &&
      !(await tx.inventoryCategory.findFirst({
        where: { tenantId, id: dto.categoryId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Category not found');
    if (
      dto.unitOfMeasureId &&
      !(await tx.unitOfMeasure.findFirst({
        where: { tenantId, id: dto.unitOfMeasureId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Unit of measure not found');
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
    // Serialize receipts and UOM edits for this item, including the first balance insert.
    await tx.$queryRaw`SELECT "id" FROM "inventory"."InventoryItem" WHERE "tenantId" = ${tenantId} AND "id" = ${id} FOR UPDATE`;
    const item = await tx.inventoryItem.findFirst({ where: { tenantId, id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }
  updateItem(tenantId: string, id: string, dto: UpdateItemDto) {
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const item = await this.lockItem(tx, tenantId, id);
        await this.references(tx, tenantId, dto);
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
          select: { id: true },
        });
        if (!location) throw new NotFoundException('Stock location not found');
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
  async balances(tenantId: string) {
    const rows = await this.prisma.stockBalance.findMany({
      where: { tenantId },
      include: { item: { select: { reorderLevel: true } } },
      orderBy: [{ itemId: 'asc' }, { locationId: 'asc' }],
    });
    return rows.map(({ item, ...row }) => ({
      ...row,
      isLowStock: item.reorderLevel === null ? null : row.quantity.lte(item.reorderLevel),
    }));
  }
  movements(tenantId: string) {
    return this.prisma.stockMovement.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}

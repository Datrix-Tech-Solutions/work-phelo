import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PartyKind, Prisma, StockMovementType } from '../prisma/generated/client';
import { PrismaService } from './prisma/prisma.service';
import {
  ItemDto,
  UpdateItemDto,
  LocationDto,
  UpdateLocationDto,
  CategoryDto,
  UpdateCategoryDto,
  PartyDto,
  UpdatePartyDto,
  SubcategoryDto,
  UpdateSubcategoryDto,
  VariantDto,
  UpdateVariantDto,
  AdjustmentReasonDto,
  UpdateAdjustmentReasonDto,
  UnitDto,
  UpdateUnitDto,
  StockInDto,
  AssignVariantDto,
  StockInBatchDto,
  StockOutBatchDto,
  StockTransferBatchDto,
  StockAdjustmentBatchDto,
  StockOutDto,
  StockTransferDto,
  StockAdjustmentDto,
  StockAdjustmentType,
  StockBalanceStatus,
} from './inventory.dto';

// The reasons every company starts with; others are added by the company. A movement stores the code.
const DEFAULT_ADJUSTMENT_REASONS = [
  { code: 'DAMAGE', name: 'Damage' },
  { code: 'LOSS', name: 'Loss' },
  { code: 'THEFT', name: 'Theft' },
  { code: 'PHYSICAL_COUNT_DIFFERENCE', name: 'Physical Count Difference' },
  { code: 'DATA_CORRECTION', name: 'Data Correction' },
  { code: 'EXPIRED_GOODS', name: 'Expired Goods' },
];

const reasonCode = (name: string) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'REASON';

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
    subcategory?: { id: string; categoryId: string },
  ) {
    if (subcategory) {
      const found = await tx.inventorySubcategory.findFirst({
        where: { tenantId, id: subcategory.id },
        select: { categoryId: true, status: true },
      });
      if (!found) throw new NotFoundException('Subcategory not found');
      if (found.categoryId !== subcategory.categoryId)
        throw new ConflictException('Subcategory belongs to a different category');
      if (found.status !== 'ACTIVE') throw new ConflictException('Subcategory is inactive');
    }
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
        await this.references(
          tx,
          tenantId,
          dto,
          dto.subcategoryId ? { id: dto.subcategoryId, categoryId: dto.categoryId } : undefined,
        );
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
        // A subcategory belongs to one category: changing the category drops the old subcategory
        // unless a new one is sent.
        const categoryId = dto.categoryId ?? item.categoryId;
        const subcategoryId =
          dto.subcategoryId !== undefined
            ? dto.subcategoryId
            : categoryId !== item.categoryId
              ? null
              : item.subcategoryId;
        await this.references(
          tx,
          tenantId,
          {
            categoryId: dto.categoryId !== item.categoryId ? dto.categoryId : undefined,
            unitOfMeasureId:
              dto.unitOfMeasureId !== item.unitOfMeasureId ? dto.unitOfMeasureId : undefined,
          },
          subcategoryId && subcategoryId !== item.subcategoryId
            ? { id: subcategoryId, categoryId }
            : undefined,
        );
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
        return tx.inventoryItem.update({
          where: { tenantId_id: { tenantId, id } },
          data: { ...dto, subcategoryId },
        });
      }),
    );
  }
  /**
   * Applies every line in ONE transaction under a shared batchId: if any line fails (for example
   * insufficient stock) nothing is saved. Lines are processed in item order so concurrent batches
   * lock items in the same order and cannot deadlock.
   */
  private batch<L extends { itemId: string }, R>(
    lines: L[],
    apply: (tx: Prisma.TransactionClient, line: L, batchId: string) => Promise<R>,
  ) {
    const batchId = randomUUID();
    const ordered = [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId));
    return this.write(() =>
      this.prisma.$transaction(
        async (tx) => {
          const results: R[] = [];
          for (const line of ordered) results.push(await apply(tx, line, batchId));
          return { batchId, results };
        },
        { timeout: 30_000, maxWait: 10_000 },
      ),
    );
  }
  // ---- Customers and suppliers ----
  listParties(tenantId: string, kind?: PartyKind) {
    return this.prisma.inventoryParty.findMany({
      where: { tenantId, ...(kind ? { kind } : {}) },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
  async getParty(tenantId: string, id: string) {
    const record = await this.prisma.inventoryParty.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Inventory record not found');
    return record;
  }
  createParty(tenantId: string, dto: PartyDto) {
    return this.write(() => this.prisma.inventoryParty.create({ data: { ...dto, tenantId } }));
  }
  async updateParty(tenantId: string, id: string, dto: UpdatePartyDto) {
    await this.getParty(tenantId, id);
    return this.write(() =>
      this.prisma.inventoryParty.update({ where: { tenantId_id: { tenantId, id } }, data: dto }),
    );
  }
  async deleteParty(tenantId: string, id: string) {
    await this.getParty(tenantId, id);
    await this.write(() =>
      this.prisma.inventoryParty.delete({ where: { tenantId_id: { tenantId, id } } }),
    );
  }

  // ---- Subcategories ----
  async listSubcategories(tenantId: string, categoryId?: string) {
    const rows = await this.prisma.inventorySubcategory.findMany({
      where: { tenantId, ...(categoryId ? { categoryId } : {}) },
      include: { _count: { select: { items: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(({ _count, ...row }) => ({ ...row, itemCount: _count.items }));
  }
  async getSubcategory(tenantId: string, id: string) {
    const record = await this.prisma.inventorySubcategory.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Subcategory not found');
    return record;
  }
  async createSubcategory(tenantId: string, dto: SubcategoryDto) {
    await this.getCategory(tenantId, dto.categoryId);
    return this.write(() =>
      this.prisma.inventorySubcategory.create({ data: { ...dto, tenantId } }),
    );
  }
  async updateSubcategory(tenantId: string, id: string, dto: UpdateSubcategoryDto) {
    await this.getSubcategory(tenantId, id);
    return this.write(() =>
      this.prisma.inventorySubcategory.update({
        where: { tenantId_id: { tenantId, id } },
        data: dto,
      }),
    );
  }
  async deleteSubcategory(tenantId: string, id: string) {
    await this.getSubcategory(tenantId, id);
    await this.write(() =>
      this.prisma.inventorySubcategory.delete({ where: { tenantId_id: { tenantId, id } } }),
    );
  }

  // ---- Item variants ----
  listVariants(tenantId: string, itemId?: string) {
    return this.prisma.itemVariant.findMany({
      where: { tenantId, ...(itemId ? { itemId } : {}) },
      orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
    });
  }
  async getVariant(tenantId: string, id: string) {
    const record = await this.prisma.itemVariant.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Variant not found');
    return record;
  }
  async createVariant(tenantId: string, dto: VariantDto) {
    await this.getItem(tenantId, dto.itemId);
    return this.write(() => this.prisma.itemVariant.create({ data: { ...dto, tenantId } }));
  }
  async updateVariant(tenantId: string, id: string, dto: UpdateVariantDto) {
    await this.getVariant(tenantId, id);
    return this.write(() =>
      this.prisma.itemVariant.update({ where: { tenantId_id: { tenantId, id } }, data: dto }),
    );
  }
  async deleteVariant(tenantId: string, id: string) {
    await this.getVariant(tenantId, id);
    await this.write(() =>
      this.prisma.itemVariant.delete({ where: { tenantId_id: { tenantId, id } } }),
    );
  }

  // ---- Adjustment reasons ----
  private ensureDefaultReasons(client: Prisma.TransactionClient | PrismaService, tenantId: string) {
    return client.adjustmentReason.createMany({
      data: DEFAULT_ADJUSTMENT_REASONS.map((r) => ({ ...r, tenantId, isSystem: true })),
      skipDuplicates: true,
    });
  }
  async listReasons(tenantId: string) {
    await this.ensureDefaultReasons(this.prisma, tenantId);
    return this.prisma.adjustmentReason.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }
  private async getReason(tenantId: string, id: string) {
    const record = await this.prisma.adjustmentReason.findFirst({ where: { id, tenantId } });
    if (!record) throw new NotFoundException('Adjustment reason not found');
    return record;
  }
  async createReason(tenantId: string, dto: AdjustmentReasonDto) {
    await this.ensureDefaultReasons(this.prisma, tenantId);
    return this.write(() =>
      this.prisma.adjustmentReason.create({
        data: { tenantId, name: dto.name, code: reasonCode(dto.name), status: dto.status },
      }),
    );
  }
  async updateReason(tenantId: string, id: string, dto: UpdateAdjustmentReasonDto) {
    const reason = await this.getReason(tenantId, id);
    if (reason.isSystem && dto.name !== undefined && dto.name !== reason.name)
      throw new ConflictException('Built-in reasons cannot be renamed');
    return this.write(() => this.prisma.adjustmentReason.update({ where: { id }, data: dto }));
  }
  async deleteReason(tenantId: string, id: string) {
    const reason = await this.getReason(tenantId, id);
    if (reason.isSystem) throw new ConflictException('Built-in reasons cannot be deleted');
    const used = await this.prisma.stockMovement.findFirst({
      where: { tenantId, adjustmentReason: reason.code },
      select: { id: true },
    });
    if (used) throw new ConflictException('Reason is used by stock adjustments');
    await this.write(() => this.prisma.adjustmentReason.delete({ where: { id } }));
  }
  /** An adjustment's reason must be one of the company's active reasons. */
  private async requireReason(tx: Prisma.TransactionClient, tenantId: string, code: string) {
    let reason = await tx.adjustmentReason.findFirst({ where: { tenantId, code } });
    if (!reason && DEFAULT_ADJUSTMENT_REASONS.some((r) => r.code === code)) {
      await this.ensureDefaultReasons(tx, tenantId);
      reason = await tx.adjustmentReason.findFirst({ where: { tenantId, code } });
    }
    if (!reason) throw new BadRequestException('Unknown adjustment reason');
    if (reason.status !== 'ACTIVE') throw new ConflictException('Adjustment reason is inactive');
  }

  /**
   * The item's variant a movement line names. Only stock in may create one that doesn't exist yet.
   * Called with the item already locked, so two lines can't create the same variant at once.
   */
  private async resolveVariant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    name: string | null | undefined,
    create: boolean,
  ) {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    let variant = await tx.itemVariant.findFirst({ where: { tenantId, itemId, name: trimmed } });
    if (!variant) {
      if (!create) throw new NotFoundException('Variant not found for this item');
      variant = await tx.itemVariant.create({ data: { tenantId, itemId, name: trimmed } });
    }
    if (variant.status !== 'ACTIVE') throw new ConflictException('Variant is inactive');
    return variant;
  }
  private variantWhere(tenantId: string, itemId: string, locationId: string, variantId: string) {
    return { tenantId_itemId_locationId_variantId: { tenantId, itemId, locationId, variantId } };
  }
  /** Stock arriving at a location under a variant (the item's total is updated separately). */
  private addVariantStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    locationId: string,
    variantId: string | undefined,
    quantity: Prisma.Decimal,
  ) {
    if (!variantId) return Promise.resolve(null);
    return tx.variantBalance.upsert({
      where: this.variantWhere(tenantId, itemId, locationId, variantId),
      create: { tenantId, itemId, locationId, variantId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }
  /**
   * Stock leaving a location. With a variant it must come out of that variant's stock; without
   * one it may only take what no variant accounts for, so a variant's count never overstates.
   * The item's total balance has already been checked and locked by sourceBalance.
   */
  private async takeStock(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    locationId: string,
    variantId: string | undefined,
    quantity: Prisma.Decimal,
    total: Prisma.Decimal,
  ) {
    if (variantId) {
      const where = this.variantWhere(tenantId, itemId, locationId, variantId);
      const held = await tx.variantBalance.findUnique({ where });
      if (!held || held.quantity.lt(quantity))
        throw new ConflictException('Insufficient stock of this variant');
      await tx.variantBalance.update({ where, data: { quantity: { decrement: quantity } } });
      return;
    }
    const tagged = await tx.variantBalance.aggregate({
      where: { tenantId, itemId, locationId },
      _sum: { quantity: true },
    });
    const taggedQuantity = tagged._sum.quantity;
    if (taggedQuantity && total.minus(taggedQuantity).lt(quantity))
      throw new ConflictException('Insufficient stock without a variant; choose a variant');
  }
  /**
   * Batch/lot details of a stock in line. The lot number is always optional. A perishable item
   * needs an expiry date (the manufacturing date is optional); any other item takes neither date.
   */
  private lotDetails(
    isPerishable: boolean,
    dto: Pick<StockInDto, 'lotNumber' | 'manufactureDate' | 'expiryDate'>,
  ) {
    const manufactureDate = dto.manufactureDate || null;
    const expiryDate = dto.expiryDate || null;
    if (isPerishable) {
      if (!expiryDate)
        throw new BadRequestException('Expiry date is required for perishable items');
      if (manufactureDate && expiryDate < manufactureDate)
        throw new BadRequestException('Expiry date cannot be before the manufacturing date');
    } else if (manufactureDate || expiryDate) {
      throw new BadRequestException(
        'Manufacturing and expiry dates apply to perishable items only',
      );
    }
    return {
      lotNumber: dto.lotNumber || null,
      manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    };
  }
  private async stockInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: StockInDto,
    batchId: string | null,
  ) {
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    const item = await this.lockItem(tx, tenantId, dto.itemId);
    if (item.status !== 'ACTIVE')
      throw new ConflictException('Inactive items cannot receive stock');
    const location = await tx.stockLocation.findFirst({
      where: { tenantId, id: dto.locationId },
      select: { id: true, status: true },
    });
    if (!location) throw new NotFoundException('Stock location not found');
    if (location.status !== 'ACTIVE') throw new ConflictException('Stock location is inactive');
    const variant = await this.resolveVariant(tx, tenantId, item.id, dto.variant, true);
    const lot = this.lotDetails(item.isPerishable, dto);
    const unitCost = dto.unitCost == null ? null : new StockDecimal(dto.unitCost);
    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        itemId: item.id,
        locationId: location.id,
        unitOfMeasureId: item.unitOfMeasureId,
        variantId: variant?.id,
        type: 'STOCK_IN',
        quantity,
        unitCost,
        totalCost: unitCost === null ? null : quantity.mul(unitCost),
        date: new Date(dto.dateReceived),
        source: dto.source,
        supplier: dto.supplier,
        reference: dto.reference,
        notes: dto.notes,
        ...lot,
        createdBy: userId,
        batchId,
      },
    });
    const balance = await tx.stockBalance.upsert({
      where: {
        tenantId_itemId_locationId: { tenantId, itemId: item.id, locationId: location.id },
      },
      create: { tenantId, itemId: item.id, locationId: location.id, quantity },
      update: { quantity: { increment: quantity } },
    });
    await this.addVariantStock(tx, tenantId, item.id, location.id, variant?.id, quantity);
    return { movement, balance };
  }
  stockIn(tenantId: string, userId: string, dto: StockInDto) {
    return this.write(() =>
      this.prisma.$transaction((tx) => this.stockInTx(tx, tenantId, userId, dto, null)),
    );
  }
  stockInBatch(tenantId: string, userId: string, dto: StockInBatchDto) {
    const { lines, ...header } = dto;
    return this.batch(lines, (tx, line, batchId) =>
      this.stockInTx(
        tx,
        tenantId,
        userId,
        {
          ...header,
          itemId: line.itemId,
          quantity: line.quantity,
          variant: line.variant,
          unitCost: line.unitCost,
          lotNumber: line.lotNumber,
          manufactureDate: line.manufactureDate,
          expiryDate: line.expiryDate,
        },
        batchId,
      ),
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
  private async stockOutTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: StockOutDto,
    batchId: string | null,
  ) {
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    const item = await this.lockItem(tx, tenantId, dto.itemId);
    if (item.status !== 'ACTIVE') throw new ConflictException('Inactive items cannot issue stock');
    await this.requireLocations(tx, tenantId, [dto.locationId]);
    const variant = await this.resolveVariant(tx, tenantId, item.id, dto.variant, false);
    const held = await this.sourceBalance(tx, tenantId, item.id, dto.locationId, quantity);
    await this.takeStock(
      tx,
      tenantId,
      item.id,
      dto.locationId,
      variant?.id,
      quantity,
      held.quantity,
    );
    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        itemId: item.id,
        locationId: dto.locationId,
        unitOfMeasureId: item.unitOfMeasureId,
        variantId: variant?.id,
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
        batchId,
      },
    });
    const balance = await tx.stockBalance.update({
      where: {
        tenantId_itemId_locationId: { tenantId, itemId: item.id, locationId: dto.locationId },
      },
      data: { quantity: { decrement: quantity } },
    });
    return { movement, balance };
  }
  stockOut(tenantId: string, userId: string, dto: StockOutDto) {
    return this.write(() =>
      this.prisma.$transaction((tx) => this.stockOutTx(tx, tenantId, userId, dto, null)),
    );
  }
  stockOutBatch(tenantId: string, userId: string, dto: StockOutBatchDto) {
    const { lines, ...header } = dto;
    return this.batch(lines, (tx, line, batchId) =>
      this.stockOutTx(
        tx,
        tenantId,
        userId,
        { ...header, itemId: line.itemId, quantity: line.quantity, variant: line.variant },
        batchId,
      ),
    );
  }
  private async transferTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: StockTransferDto,
    batchId: string | null,
  ) {
    if (dto.sourceLocationId === dto.destinationLocationId)
      throw new BadRequestException('Source and destination must differ');
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    const item = await this.lockItem(tx, tenantId, dto.itemId);
    if (item.status !== 'ACTIVE')
      throw new ConflictException('Inactive items cannot transfer stock');
    await this.requireLocations(tx, tenantId, [dto.sourceLocationId, dto.destinationLocationId]);
    const variant = await this.resolveVariant(tx, tenantId, item.id, dto.variant, false);
    const held = await this.sourceBalance(tx, tenantId, item.id, dto.sourceLocationId, quantity);
    await this.takeStock(
      tx,
      tenantId,
      item.id,
      dto.sourceLocationId,
      variant?.id,
      quantity,
      held.quantity,
    );
    await this.addVariantStock(
      tx,
      tenantId,
      item.id,
      dto.destinationLocationId,
      variant?.id,
      quantity,
    );
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
      variantId: variant?.id,
      quantity,
      unitCost: null,
      totalCost: null,
      transferId,
      date: new Date(dto.date),
      reference: dto.reference,
      notes: dto.notes,
      createdBy: userId,
      batchId,
    };
    const out = await tx.stockMovement.create({
      data: { ...data, type: 'TRANSFER_OUT', locationId: dto.sourceLocationId },
    });
    const incoming = await tx.stockMovement.create({
      data: { ...data, type: 'TRANSFER_IN', locationId: dto.destinationLocationId },
    });
    return { transferId, movements: [out, incoming], sourceBalance, destinationBalance };
  }
  transfer(tenantId: string, userId: string, dto: StockTransferDto) {
    return this.write(() =>
      this.prisma.$transaction((tx) => this.transferTx(tx, tenantId, userId, dto, null)),
    );
  }
  transferBatch(tenantId: string, userId: string, dto: StockTransferBatchDto) {
    const { lines, ...header } = dto;
    return this.batch(lines, (tx, line, batchId) =>
      this.transferTx(
        tx,
        tenantId,
        userId,
        { ...header, itemId: line.itemId, quantity: line.quantity, variant: line.variant },
        batchId,
      ),
    );
  }
  private async adjustTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: StockAdjustmentDto,
    batchId: string | null,
  ) {
    const quantity = new StockDecimal(dto.quantity);
    if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
    const decrease = dto.type === StockAdjustmentType.DECREASE;
    const item = await this.lockItem(tx, tenantId, dto.itemId);
    if (item.status !== 'ACTIVE') throw new ConflictException('Inactive items cannot adjust stock');
    await this.requireLocations(tx, tenantId, [dto.locationId]);
    await this.requireReason(tx, tenantId, dto.reason);
    const variant = await this.resolveVariant(tx, tenantId, item.id, dto.variant, false);
    if (decrease) {
      const held = await this.sourceBalance(tx, tenantId, item.id, dto.locationId, quantity);
      await this.takeStock(
        tx,
        tenantId,
        item.id,
        dto.locationId,
        variant?.id,
        quantity,
        held.quantity,
      );
    } else {
      await this.addVariantStock(tx, tenantId, item.id, dto.locationId, variant?.id, quantity);
    }
    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        itemId: item.id,
        locationId: dto.locationId,
        unitOfMeasureId: item.unitOfMeasureId,
        variantId: variant?.id,
        type: decrease ? 'ADJUSTMENT_DECREASE' : 'ADJUSTMENT_INCREASE',
        quantity,
        adjustmentReason: dto.reason,
        date: new Date(dto.date),
        reference: dto.reference,
        notes: dto.notes,
        createdBy: userId,
        batchId,
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
  }
  adjust(tenantId: string, userId: string, dto: StockAdjustmentDto) {
    return this.write(() =>
      this.prisma.$transaction((tx) => this.adjustTx(tx, tenantId, userId, dto, null)),
    );
  }
  adjustBatch(tenantId: string, userId: string, dto: StockAdjustmentBatchDto) {
    const { lines, ...header } = dto;
    return this.batch(lines, (tx, line, batchId) =>
      this.adjustTx(
        tx,
        tenantId,
        userId,
        { ...header, itemId: line.itemId, quantity: line.quantity, variant: line.variant },
        batchId,
      ),
    );
  }
  /**
   * Counts stock an item held without a variant as one of its variants. The item's total doesn't
   * change; the history shows the stock leaving "no variant" and arriving under the variant.
   */
  assignVariant(tenantId: string, userId: string, dto: AssignVariantDto) {
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const quantity = new StockDecimal(dto.quantity);
        if (!quantity.gt(0)) throw new BadRequestException('Quantity must be greater than zero');
        const item = await this.lockItem(tx, tenantId, dto.itemId);
        if (item.status !== 'ACTIVE')
          throw new ConflictException('Inactive items cannot adjust stock');
        await this.requireLocations(tx, tenantId, [dto.locationId]);
        const variant = await this.resolveVariant(tx, tenantId, item.id, dto.variant, false);
        if (!variant) throw new BadRequestException('Choose a variant');
        const held = await this.sourceBalance(tx, tenantId, item.id, dto.locationId, quantity);
        const tagged = await tx.variantBalance.aggregate({
          where: { tenantId, itemId: item.id, locationId: dto.locationId },
          _sum: { quantity: true },
        });
        const untagged = held.quantity.minus(tagged._sum.quantity ?? 0);
        if (untagged.lt(quantity))
          throw new ConflictException('Insufficient stock without a variant');
        await this.addVariantStock(tx, tenantId, item.id, dto.locationId, variant.id, quantity);
        const batchId = randomUUID();
        const row = (type: 'ADJUSTMENT_DECREASE' | 'ADJUSTMENT_INCREASE', variantId?: string) => ({
          tenantId,
          itemId: item.id,
          locationId: dto.locationId,
          unitOfMeasureId: item.unitOfMeasureId,
          variantId,
          type,
          quantity,
          adjustmentReason: 'VARIANT_ASSIGNMENT',
          date: new Date(),
          notes: dto.notes,
          createdBy: userId,
          batchId,
          unitCost: null,
          totalCost: null,
        });
        await tx.stockMovement.create({ data: row('ADJUSTMENT_DECREASE') });
        await tx.stockMovement.create({ data: row('ADJUSTMENT_INCREASE', variant.id) });
        return { batchId, variant: variant.name, quantity };
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
  async movements(tenantId: string, types?: StockMovementType[]) {
    const rows = await this.prisma.stockMovement.findMany({
      where: { tenantId, ...(types ? { type: { in: types } } : {}) },
      include: { variant: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(({ variant, ...row }) => ({ ...row, variant: variant?.name ?? null }));
  }
  /** Stock held under each variant at each location. */
  async variantBalances(tenantId: string) {
    const rows = await this.prisma.variantBalance.findMany({
      where: { tenantId },
      include: { variant: { select: { name: true } } },
      orderBy: [{ itemId: 'asc' }, { locationId: 'asc' }, { variantId: 'asc' }],
    });
    return rows.map(({ variant, ...row }) => ({ ...row, variant: variant.name }));
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PartyKind, Prisma, StockLot, StockMovementType } from '../prisma/generated/client';
import { PrismaService } from './prisma/prisma.service';
import {
  ItemDto,
  BulkImportItemsDto,
  SupplierPaymentDto,
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
  PurchaseOrderDto,
  ReceivePurchaseOrderDto,
  ReceiveLineDto,
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

/** Part of a line's quantity and the lot it comes from; null for stock that has no lot. */
interface LotPart {
  lot: StockLot | null;
  quantity: Prisma.Decimal;
}

// Two Decimal(18,4) inputs can produce 36 significant digits.
const StockDecimal = Prisma.Decimal.clone({ precision: 40 });

// What an order reports about its payments: each share, with the payment it belongs to.
const PAYMENT_SHARES = {
  select: {
    id: true,
    amount: true,
    payment: { select: { paymentDate: true, method: true, reference: true, notes: true } },
  },
  orderBy: { payment: { paymentDate: 'asc' } },
} satisfies Prisma.PurchaseOrder$paymentsArgs;

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
  /**
   * Creates items from spreadsheet rows. Categories, subcategories and units are matched by name
   * (ignoring case) and created when they don't exist yet. Each row is its own transaction, so one
   * bad row neither blocks the others nor leaves a stray category behind; a SKU that already
   * exists is skipped.
   */
  async bulkImportItems(tenantId: string, dto: BulkImportItemsDto) {
    const key = (value: string) => value.trim().toLowerCase();
    const [categories, subcategories, units, items] = await Promise.all([
      this.prisma.inventoryCategory.findMany({ where: { tenantId } }),
      this.prisma.inventorySubcategory.findMany({ where: { tenantId } }),
      this.prisma.unitOfMeasure.findMany({ where: { tenantId } }),
      this.prisma.inventoryItem.findMany({ where: { tenantId }, select: { sku: true } }),
    ]);
    const categoryByName = new Map(categories.map((c) => [key(c.name), c]));
    const subcategoryByName = new Map(
      subcategories.map((s) => [`${s.categoryId}|${key(s.name)}`, s]),
    );
    const unitByName = new Map(units.map((u) => [key(u.name), u]));
    const skus = new Set(items.map((i) => key(i.sku)));

    const createdCategories: string[] = [];
    const createdSubcategories: string[] = [];
    const createdUnits: string[] = [];
    const results: {
      sku: string;
      status: 'created' | 'skipped' | 'failed';
      id?: string;
      message?: string;
    }[] = [];

    for (const row of dto.rows) {
      if (skus.has(key(row.sku))) {
        results.push({ sku: row.sku, status: 'skipped', message: 'Already exists' });
        continue;
      }
      if (row.reorderLevel != null && row.maxStock != null) {
        if (new Prisma.Decimal(row.maxStock).lt(row.reorderLevel)) {
          results.push({
            sku: row.sku,
            status: 'failed',
            message: 'Maximum stock is below the reorder level',
          });
          continue;
        }
      }
      try {
        const made = await this.prisma.$transaction(async (tx) => {
          let category = categoryByName.get(key(row.category));
          let newCategory: typeof category;
          if (!category) {
            newCategory = await tx.inventoryCategory.create({
              data: { tenantId, name: row.category },
            });
            category = newCategory;
          } else if (category.status !== 'ACTIVE') {
            throw new ConflictException(`Category "${category.name}" is inactive`);
          }

          let subcategory = row.subcategory
            ? subcategoryByName.get(`${category.id}|${key(row.subcategory)}`)
            : undefined;
          let newSubcategory: typeof subcategory;
          if (row.subcategory && !subcategory) {
            newSubcategory = await tx.inventorySubcategory.create({
              data: { tenantId, categoryId: category.id, name: row.subcategory },
            });
            subcategory = newSubcategory;
          } else if (subcategory && subcategory.status !== 'ACTIVE') {
            throw new ConflictException(`Subcategory "${subcategory.name}" is inactive`);
          }

          let unit = unitByName.get(key(row.unit));
          let newUnit: typeof unit;
          if (!unit) {
            const id = randomUUID();
            newUnit = await tx.unitOfMeasure.create({
              data: {
                id,
                tenantId,
                name: row.unit,
                symbol: row.unitSymbol || row.unit.slice(0, 10),
              },
            });
            unit = newUnit;
          } else if (unit.status !== 'ACTIVE') {
            throw new ConflictException(`Unit "${unit.name}" is inactive`);
          }

          const item = await tx.inventoryItem.create({
            data: {
              tenantId,
              name: row.name,
              sku: row.sku,
              categoryId: category.id,
              subcategoryId: subcategory?.id ?? null,
              unitOfMeasureId: unit.id,
              description: row.description ?? null,
              costPrice: row.costPrice ?? null,
              sellingPrice: row.sellingPrice ?? null,
              reorderLevel: row.reorderLevel ?? null,
              maxStock: row.maxStock ?? null,
              isPerishable: row.isPerishable ?? false,
              status: row.status ?? 'ACTIVE',
            },
          });
          // Each variant once, ignoring case: the first spelling wins.
          const seenVariants = new Set<string>();
          const variants = (row.variants ?? [])
            .map((name) => name.trim())
            .filter((name) => name && !seenVariants.has(key(name)) && seenVariants.add(key(name)));
          if (variants.length > 0)
            await tx.itemVariant.createMany({
              data: variants.map((name) => ({ tenantId, itemId: item.id, name })),
            });
          return { item, newCategory, newSubcategory, newUnit };
        });
        // Only remember what was created once the row has committed.
        if (made.newCategory) {
          categoryByName.set(key(made.newCategory.name), made.newCategory);
          createdCategories.push(made.newCategory.name);
        }
        if (made.newSubcategory) {
          subcategoryByName.set(
            `${made.newSubcategory.categoryId}|${key(made.newSubcategory.name)}`,
            made.newSubcategory,
          );
          createdSubcategories.push(made.newSubcategory.name);
        }
        if (made.newUnit) {
          unitByName.set(key(made.newUnit.name), made.newUnit);
          createdUnits.push(made.newUnit.name);
        }
        skus.add(key(row.sku));
        results.push({ sku: row.sku, status: 'created', id: made.item.id });
      } catch (error) {
        results.push({ sku: row.sku, status: 'failed', message: this.importErrorMessage(error) });
      }
    }
    return { results, createdCategories, createdSubcategories, createdUnits };
  }
  private importErrorMessage(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return 'Name or SKU already exists';
      if (['P2020', 'P2000', 'P2033'].includes(error.code))
        return 'A value is too large or too long';
    }
    if (error instanceof Error) return error.message;
    return 'Could not import this row';
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
    purchaseOrderLineId: string | null = null,
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
    let lot: ReturnType<InventoryService['lotDetails']>;
    let lotId: string | null;
    if (dto.lotId) {
      // Adding to a batch that already exists: it keeps its own number and dates.
      if (dto.lotNumber || dto.manufactureDate || dto.expiryDate)
        throw new BadRequestException(
          'A batch to add to cannot be combined with a lot number or dates',
        );
      const existing = await this.requireLot(
        tx,
        tenantId,
        item.id,
        location.id,
        variant?.id ?? null,
        dto.lotId,
      );
      await tx.stockLot.update({
        where: { id: existing.id },
        data: {
          receivedQuantity: { increment: quantity },
          remainingQuantity: { increment: quantity },
        },
      });
      lot = { lotNumber: null, manufactureDate: null, expiryDate: null };
      lotId = existing.id;
    } else {
      lot = this.lotDetails(item.isPerishable, dto);
      // A line that names a batch or an expiry date starts a lot that stock out can draw on.
      lotId = lot.lotNumber || lot.expiryDate ? randomUUID() : null;
    }
    if (lotId && !dto.lotId)
      await tx.stockLot.create({
        data: {
          id: lotId,
          tenantId,
          itemId: item.id,
          locationId: location.id,
          variantId: variant?.id,
          ...lot,
          receivedQuantity: quantity,
          remainingQuantity: quantity,
        },
      });
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
        lotId,
        purchaseOrderLineId,
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
          lotId: line.lotId,
        },
        batchId,
      ),
    );
  }
  // ---- Purchase orders ----
  private async lockPurchaseOrder(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "inventory"."PurchaseOrder" WHERE "tenantId" = ${tenantId} AND "id" = ${id} FOR UPDATE`;
    const order = await tx.purchaseOrder.findFirst({
      where: { tenantId, id },
      include: { lines: { orderBy: { id: 'asc' } }, supplier: { select: { name: true } } },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }
  private purchaseOrderStatus(
    lines: { orderedQuantity: Prisma.Decimal; receivedQuantity: Prisma.Decimal }[],
  ) {
    if (lines.every((l) => l.receivedQuantity.gte(l.orderedQuantity))) return 'RECEIVED' as const;
    if (lines.some((l) => l.receivedQuantity.gt(0))) return 'PARTIALLY_RECEIVED' as const;
    return 'ORDERED' as const;
  }
  listPurchaseOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        lines: { orderBy: { id: 'asc' } },
        supplier: { select: { name: true } },
        payments: PAYMENT_SHARES,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
  async getPurchaseOrder(tenantId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { tenantId, id },
      include: {
        lines: { orderBy: { id: 'asc' } },
        supplier: { select: { name: true } },
        payments: PAYMENT_SHARES,
      },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }
  createPurchaseOrder(tenantId: string, userId: string, dto: PurchaseOrderDto) {
    if (dto.expectedDate && dto.expectedDate < dto.orderDate)
      throw new BadRequestException('Expected delivery cannot be before the order date');
    const keys = dto.lines.map((l) => `${l.itemId}\u0000${(l.variant ?? '').toLowerCase()}`);
    if (new Set(keys).size !== keys.length)
      throw new BadRequestException('An item and variant can only appear once on an order');
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const supplier = await tx.inventoryParty.findFirst({
          where: { tenantId, id: dto.supplierId },
          select: { kind: true, status: true },
        });
        if (!supplier || supplier.kind !== 'SUPPLIER')
          throw new NotFoundException('Supplier not found');
        if (supplier.status !== 'ACTIVE') throw new ConflictException('Supplier is inactive');
        const location = await tx.stockLocation.findFirst({
          where: { tenantId, id: dto.locationId },
          select: { status: true },
        });
        if (!location) throw new NotFoundException('Stock location not found');
        if (location.status !== 'ACTIVE') throw new ConflictException('Stock location is inactive');
        const itemIds = [...new Set(dto.lines.map((l) => l.itemId))];
        const items = await tx.inventoryItem.findMany({
          where: { tenantId, id: { in: itemIds } },
          select: { status: true },
        });
        if (items.length !== itemIds.length)
          throw new NotFoundException('Inventory item not found');
        if (items.some((i) => i.status !== 'ACTIVE'))
          throw new ConflictException('Inactive items cannot be ordered');
        const reference =
          dto.reference ||
          `PO-${dto.orderDate.replace(/-/g, '')}-${randomUUID().slice(0, 4).toUpperCase()}`;
        try {
          return await tx.purchaseOrder.create({
            data: {
              tenantId,
              reference,
              orderDate: new Date(dto.orderDate),
              expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
              supplierId: dto.supplierId,
              locationId: dto.locationId,
              paymentTerms: dto.paymentTerms || null,
              notes: dto.notes || null,
              createdBy: userId,
              lines: {
                // tenantId is left out on purpose: a nested line takes it from the order.
                create: dto.lines.map((l) => ({
                  itemId: l.itemId,
                  variantName: l.variant || null,
                  orderedQuantity: new StockDecimal(l.quantity),
                  unitCost: new StockDecimal(l.unitCost),
                })),
              },
            },
            include: { lines: { orderBy: { id: 'asc' } }, supplier: { select: { name: true } } },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
            throw new ConflictException('Purchase order reference already exists');
          throw error;
        }
      }),
    );
  }
  /**
   * Receives goods against an order and posts them as one stock in. Each line takes the units
   * that arrived (paid for, at most what is still outstanding) plus any free extra; the stock in
   * holds both, valued at the order's unit cost, while only the first counts toward what is owed.
   */
  receivePurchaseOrder(tenantId: string, userId: string, id: string, dto: ReceivePurchaseOrderDto) {
    const ids = dto.lines.map((l) => l.lineId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('A line can only appear once in a receipt');
    return this.write(() =>
      this.prisma.$transaction(
        async (tx) => {
          const order = await this.lockPurchaseOrder(tx, tenantId, id);
          if (order.status === 'CANCELLED') throw new ConflictException('The order is cancelled');
          if (order.status === 'CLOSED') throw new ConflictException('The order is closed');
          if (order.status === 'RECEIVED')
            throw new ConflictException('The order has already been received in full');
          const batchId = randomUUID();
          const received: {
            line: (typeof order.lines)[number];
            received: Prisma.Decimal;
            extra: Prisma.Decimal;
            input: ReceiveLineDto;
          }[] = [];
          for (const input of dto.lines) {
            const line = order.lines.find((l) => l.id === input.lineId);
            if (!line) throw new NotFoundException('Purchase order line not found');
            const got = new StockDecimal(input.receivedQuantity);
            const extra = new StockDecimal(input.extraQuantity ?? 0);
            if (got.gt(line.orderedQuantity.minus(line.receivedQuantity)))
              throw new ConflictException('Received quantity exceeds what is still outstanding');
            if (got.plus(extra).gt(0)) received.push({ line, received: got, extra, input });
          }
          if (!received.length)
            throw new BadRequestException('Enter a quantity received for at least one line');
          received.sort((a, b) => a.line.itemId.localeCompare(b.line.itemId));
          for (const { line, received: got, extra, input } of received) {
            await this.stockInTx(
              tx,
              tenantId,
              userId,
              {
                itemId: line.itemId,
                locationId: order.locationId,
                quantity: got.plus(extra).toString(),
                variant: line.variantName,
                dateReceived: dto.dateReceived,
                supplier: order.supplier.name,
                reference: order.reference,
                notes: dto.notes ?? undefined,
                unitCost: line.unitCost.toString(),
                lotNumber: input.lotNumber,
                manufactureDate: input.manufactureDate,
                expiryDate: input.expiryDate,
              },
              batchId,
              line.id,
            );
            await tx.purchaseOrderLine.update({
              where: { id: line.id },
              data: { receivedQuantity: { increment: got }, extraQuantity: { increment: extra } },
            });
            line.receivedQuantity = line.receivedQuantity.plus(got);
          }
          await tx.purchaseOrder.update({
            where: { id: order.id },
            data: { status: this.purchaseOrderStatus(order.lines) },
          });
          return this.getPurchaseOrderIn(tx, tenantId, id, batchId);
        },
        { timeout: 30_000, maxWait: 10_000 },
      ),
    );
  }
  private async getPurchaseOrderIn(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
    batchId: string,
  ) {
    const order = await tx.purchaseOrder.findFirstOrThrow({
      where: { tenantId, id },
      include: { lines: { orderBy: { id: 'asc' } }, supplier: { select: { name: true } } },
    });
    return { ...order, batchId };
  }
  cancelPurchaseOrder(tenantId: string, id: string) {
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const order = await this.lockPurchaseOrder(tx, tenantId, id);
        if (order.status === 'CANCELLED')
          throw new ConflictException('The order is already cancelled');
        if (order.lines.some((l) => l.receivedQuantity.gt(0) || l.extraQuantity.gt(0)))
          throw new ConflictException('An order that has received stock cannot be cancelled');
        return tx.purchaseOrder.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
          include: { lines: { orderBy: { id: 'asc' } }, supplier: { select: { name: true } } },
        });
      }),
    );
  }
  /** Closes an order that was only partly delivered: the rest is no longer expected. */
  closePurchaseOrder(tenantId: string, id: string) {
    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const order = await this.lockPurchaseOrder(tx, tenantId, id);
        if (order.status === 'CLOSED') throw new ConflictException('The order is already closed');
        if (order.status === 'CANCELLED') throw new ConflictException('The order is cancelled');
        if (order.status === 'RECEIVED')
          throw new ConflictException('The order has been received in full');
        if (order.status === 'ORDERED')
          throw new ConflictException('Nothing has been received on this order: cancel it instead');
        return tx.purchaseOrder.update({
          where: { id: order.id },
          data: { status: 'CLOSED' },
          include: { lines: { orderBy: { id: 'asc' } }, supplier: { select: { name: true } } },
        });
      }),
    );
  }
  /**
   * Records a payment to a supplier and shares it out over the orders it settles. An order can be
   * paid up to what is owed on it so far (units received at their unit cost, less earlier
   * payments); nothing can be paid ahead of delivery.
   */
  createSupplierPayment(tenantId: string, userId: string, dto: SupplierPaymentDto) {
    const ids = dto.allocations.map((a) => a.purchaseOrderId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('An order can only appear once in a payment');
    return this.write(() =>
      this.prisma.$transaction(
        async (tx) => {
          const supplier = await tx.inventoryParty.findFirst({
            where: { tenantId, id: dto.supplierId },
            select: { kind: true },
          });
          if (!supplier || supplier.kind !== 'SUPPLIER')
            throw new NotFoundException('Supplier not found');
          // Locked in a fixed order, so two payments over the same orders cannot deadlock.
          const sorted = [...ids].sort();
          await tx.$queryRaw`SELECT "id" FROM "inventory"."PurchaseOrder" WHERE "tenantId" = ${tenantId} AND "id" IN (${Prisma.join(sorted)}) ORDER BY "id" FOR UPDATE`;
          const orders = await tx.purchaseOrder.findMany({
            where: { tenantId, id: { in: ids } },
            include: { lines: true, payments: { select: { amount: true } } },
          });
          if (orders.length !== ids.length) throw new NotFoundException('Purchase order not found');
          let total = new StockDecimal(0);
          for (const allocation of dto.allocations) {
            const order = orders.find((o) => o.id === allocation.purchaseOrderId)!;
            if (order.supplierId !== dto.supplierId)
              throw new ConflictException(`${order.reference} is not an order from this supplier`);
            if (order.status === 'CANCELLED')
              throw new ConflictException(`${order.reference} is cancelled`);
            const owed = order.lines
              .reduce(
                (sum, l) => sum.plus(l.receivedQuantity.times(l.unitCost)),
                new StockDecimal(0),
              )
              .minus(order.payments.reduce((sum, p) => sum.plus(p.amount), new StockDecimal(0)));
            const amount = new StockDecimal(allocation.amount);
            if (amount.gt(owed))
              throw new ConflictException(
                `${order.reference}: payment is more than the ${owed.toFixed(2)} owed on it`,
              );
            total = total.plus(amount);
          }
          return tx.supplierPayment.create({
            data: {
              tenantId,
              supplierId: dto.supplierId,
              reference: dto.reference ?? null,
              paymentDate: new Date(dto.paymentDate),
              method: dto.method,
              amount: total,
              notes: dto.notes ?? null,
              createdBy: userId,
              // The share rows take tenantId from the payment.
              allocations: {
                create: dto.allocations.map((a) => ({
                  purchaseOrderId: a.purchaseOrderId,
                  amount: a.amount,
                })),
              },
            },
            include: { allocations: true },
          });
        },
        { timeout: 30_000, maxWait: 10_000 },
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
  /**
   * Splits stock leaving a location across its lots. With a lotId everything comes from that lot.
   * Without one, lots are drawn on earliest expiry first (no expiry last), oldest first; whatever
   * the lots don't hold is stock that has no batch. The item is already locked by the caller, so
   * its lots cannot change underneath this.
   */
  private async allocateLots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    locationId: string,
    variantId: string | null,
    quantity: Prisma.Decimal,
    lotId: string | null,
  ): Promise<LotPart[]> {
    if (lotId) {
      const lot = await tx.stockLot.findFirst({ where: { tenantId, id: lotId } });
      if (!lot || lot.itemId !== itemId || lot.locationId !== locationId)
        throw new NotFoundException('Batch not found at this location');
      if ((lot.variantId ?? null) !== variantId)
        throw new ConflictException('Batch belongs to a different variant');
      if (lot.remainingQuantity.lt(quantity))
        throw new ConflictException(`Only ${lot.remainingQuantity.toString()} left in this batch`);
      await tx.stockLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: { decrement: quantity } },
      });
      return [{ lot, quantity }];
    }
    const lots = await tx.stockLot.findMany({
      where: { tenantId, itemId, locationId, variantId, remainingQuantity: { gt: 0 } },
      orderBy: [
        { expiryDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });
    const parts: LotPart[] = [];
    let left: Prisma.Decimal = quantity;
    for (const lot of lots) {
      if (left.lte(0)) break;
      const take = Prisma.Decimal.min(lot.remainingQuantity, left);
      await tx.stockLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: { decrement: take } },
      });
      parts.push({ lot, quantity: take });
      left = left.minus(take);
    }
    if (left.gt(0)) parts.push({ lot: null, quantity: left });
    return parts;
  }
  /** Unit and total cost of a movement valued at one of the item's prices; null when it has none. */
  private valued(price: Prisma.Decimal | null, quantity: Prisma.Decimal) {
    return price === null
      ? { unitCost: null, totalCost: null }
      : { unitCost: price, totalCost: new StockDecimal(quantity).mul(price) };
  }
  private groupId(batchId: string | null, parts: number) {
    return batchId ?? (parts > 1 ? randomUUID() : null);
  }
  /**
   * Adds stock to the lot at a location that matches this lot's number and dates (same item and
   * variant), or starts one. Used when a batch moves between locations.
   */
  private async receiveIntoLot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    locationId: string,
    variantId: string | null,
    source: Pick<StockLot, 'lotNumber' | 'manufactureDate' | 'expiryDate'>,
    quantity: Prisma.Decimal,
  ) {
    const same = await tx.stockLot.findFirst({
      where: {
        tenantId,
        itemId,
        locationId,
        variantId,
        lotNumber: source.lotNumber,
        manufactureDate: source.manufactureDate,
        expiryDate: source.expiryDate,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (same) {
      await tx.stockLot.update({
        where: { id: same.id },
        data: {
          receivedQuantity: { increment: quantity },
          remainingQuantity: { increment: quantity },
        },
      });
      return same.id;
    }
    const created = await tx.stockLot.create({
      data: {
        tenantId,
        itemId,
        locationId,
        variantId,
        lotNumber: source.lotNumber,
        manufactureDate: source.manufactureDate,
        expiryDate: source.expiryDate,
        receivedQuantity: quantity,
        remainingQuantity: quantity,
      },
    });
    return created.id;
  }
  /** An existing lot of this item at this location and variant, to add stock back into. */
  private async requireLot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    itemId: string,
    locationId: string,
    variantId: string | null,
    lotId: string,
  ) {
    const lot = await tx.stockLot.findFirst({ where: { tenantId, id: lotId } });
    if (!lot || lot.itemId !== itemId || lot.locationId !== locationId)
      throw new NotFoundException('Batch not found at this location');
    if ((lot.variantId ?? null) !== variantId)
      throw new ConflictException('Batch belongs to a different variant');
    return lot;
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
    const allocations = await this.allocateLots(
      tx,
      tenantId,
      item.id,
      dto.locationId,
      variant?.id ?? null,
      quantity,
      dto.lotId ?? null,
    );
    // One row per batch drawn on, so each batch's history shows what left it. Rows of a split line
    // share a batchId so they still read back as one movement.
    const groupId = this.groupId(batchId, allocations.length);
    const movements = [];
    for (const part of allocations) {
      movements.push(
        await tx.stockMovement.create({
          data: {
            tenantId,
            itemId: item.id,
            locationId: dto.locationId,
            unitOfMeasureId: item.unitOfMeasureId,
            variantId: variant?.id,
            type: 'STOCK_OUT',
            quantity: part.quantity,
            // Valued at the item's selling price when issued.
            ...this.valued(item.sellingPrice, part.quantity),
            date: new Date(dto.date),
            purpose: dto.purpose,
            recipient: dto.recipient,
            reference: dto.reference,
            notes: dto.notes,
            lotId: part.lot?.id ?? null,
            createdBy: userId,
            batchId: groupId,
          },
        }),
      );
    }
    const balance = await tx.stockBalance.update({
      where: {
        tenantId_itemId_locationId: { tenantId, itemId: item.id, locationId: dto.locationId },
      },
      data: { quantity: { decrement: quantity } },
    });
    return { movement: movements[0], movements, balance };
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
        {
          ...header,
          itemId: line.itemId,
          quantity: line.quantity,
          variant: line.variant,
          lotId: line.lotId,
        },
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
    const allocations = await this.allocateLots(
      tx,
      tenantId,
      item.id,
      dto.sourceLocationId,
      variant?.id ?? null,
      quantity,
      dto.lotId ?? null,
    );
    // Each batch moved is its own transfer, and carries its number and dates to the destination.
    // Parts of a split line share a batchId so they still read back as one movement.
    const groupId = this.groupId(batchId, allocations.length);
    const movements = [];
    let transferId = '';
    for (const part of allocations) {
      const partId = randomUUID();
      transferId ||= partId;
      const destinationLotId = part.lot
        ? await this.receiveIntoLot(
            tx,
            tenantId,
            item.id,
            dto.destinationLocationId,
            variant?.id ?? null,
            part.lot,
            part.quantity,
          )
        : null;
      const data = {
        tenantId,
        itemId: item.id,
        unitOfMeasureId: item.unitOfMeasureId,
        variantId: variant?.id,
        quantity: part.quantity,
        // Valued at the item's cost price when moved.
        ...this.valued(item.costPrice, part.quantity),
        transferId: partId,
        date: new Date(dto.date),
        reference: dto.reference,
        notes: dto.notes,
        createdBy: userId,
        batchId: groupId,
      };
      movements.push(
        await tx.stockMovement.create({
          data: {
            ...data,
            type: 'TRANSFER_OUT',
            locationId: dto.sourceLocationId,
            lotId: part.lot?.id ?? null,
          },
        }),
        await tx.stockMovement.create({
          data: {
            ...data,
            type: 'TRANSFER_IN',
            locationId: dto.destinationLocationId,
            lotId: destinationLotId,
          },
        }),
      );
    }
    return { transferId, movements, sourceBalance, destinationBalance };
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
        {
          ...header,
          itemId: line.itemId,
          quantity: line.quantity,
          variant: line.variant,
          lotId: line.lotId,
        },
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
    let allocations: LotPart[];
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
      allocations = await this.allocateLots(
        tx,
        tenantId,
        item.id,
        dto.locationId,
        variant?.id ?? null,
        quantity,
        dto.lotId ?? null,
      );
    } else {
      await this.addVariantStock(tx, tenantId, item.id, dto.locationId, variant?.id, quantity);
      // An increase can add to an existing batch; otherwise it adds stock that has no batch.
      let lot: StockLot | null = null;
      if (dto.lotId) {
        lot = await this.requireLot(
          tx,
          tenantId,
          item.id,
          dto.locationId,
          variant?.id ?? null,
          dto.lotId,
        );
        await tx.stockLot.update({
          where: { id: lot.id },
          data: {
            receivedQuantity: { increment: quantity },
            remainingQuantity: { increment: quantity },
          },
        });
      }
      allocations = [{ lot, quantity }];
    }
    const groupId = this.groupId(batchId, allocations.length);
    const movements = [];
    for (const part of allocations) {
      movements.push(
        await tx.stockMovement.create({
          data: {
            tenantId,
            itemId: item.id,
            locationId: dto.locationId,
            unitOfMeasureId: item.unitOfMeasureId,
            variantId: variant?.id,
            type: decrease ? 'ADJUSTMENT_DECREASE' : 'ADJUSTMENT_INCREASE',
            quantity: part.quantity,
            adjustmentReason: dto.reason,
            date: new Date(dto.date),
            reference: dto.reference,
            notes: dto.notes,
            lotId: part.lot?.id ?? null,
            createdBy: userId,
            batchId: groupId,
            // Valued at the item's cost price when adjusted.
            ...this.valued(item.costPrice, part.quantity),
          },
        }),
      );
    }
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
    return { movement: movements[0], movements, balance };
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
        {
          ...header,
          itemId: line.itemId,
          quantity: line.quantity,
          variant: line.variant,
          lotId: line.lotId,
        },
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
          // Valued at the item's cost price, like any adjustment.
          ...this.valued(item.costPrice, quantity),
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
  /** Batches/lots received, with how much of each is left. */
  async lots(tenantId: string, itemId?: string) {
    const rows = await this.prisma.stockLot.findMany({
      where: { tenantId, ...(itemId ? { itemId } : {}) },
      include: { variant: { select: { name: true } } },
      orderBy: [
        { expiryDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
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

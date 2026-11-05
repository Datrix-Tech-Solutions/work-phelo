import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { StockAdjustmentType } from './inventory.dto';

const localTests = process.env.INVENTORY_TEST_DATABASE_URL ? describe : describe.skip;
localTests(
  'Variants, subcategories, parties and adjustment reasons - disposable PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: InventoryService;
    let tenant: string;
    let categoryId: string;
    let unitId: string;
    let shirt: string;
    let main: string;
    let branch: string;
    const date = '2026-11-05';
    beforeAll(async () => {
      const url = new URL(process.env.INVENTORY_TEST_DATABASE_URL!);
      if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/inventory_test')
        throw new Error('Only disposable localhost inventory_test is allowed');
      prisma = new PrismaService({ datasources: { db: { url: url.toString() } } });
      await prisma.$connect();
      service = new InventoryService(prisma);
    });
    afterAll(async () => {
      await prisma?.$disconnect();
    });
    beforeEach(async () => {
      tenant = randomUUID();
      categoryId = (await service.createCategory(tenant, { name: 'Clothing' })).id;
      unitId = (await service.createUnit(tenant, { name: 'Each' })).id;
      main = (await service.createLocation(tenant, { name: 'Main', type: 'WAREHOUSE' })).id;
      branch = (await service.createLocation(tenant, { name: 'Branch', type: 'BRANCH' })).id;
      shirt = (
        await service.createItem(tenant, {
          name: 'Shirt',
          sku: 'SH',
          categoryId,
          unitOfMeasureId: unitId,
        })
      ).id;
    });
    const receive = (quantity: string, variant?: string, locationId = main) =>
      service.stockInBatch(tenant, 'user-a', {
        locationId,
        dateReceived: date,
        lines: [{ itemId: shirt, quantity, variant }],
      });
    const issue = (quantity: string, variant?: string) =>
      service.stockOutBatch(tenant, 'user-a', {
        locationId: main,
        date,
        purpose: 'SALE' as never,
        lines: [{ itemId: shirt, quantity, variant }],
      });
    const total = async (locationId = main) =>
      (await service.balances(tenant))
        .find((r) => r.locationId === locationId)
        ?.quantity.toString();
    const ofVariant = async (variant: string, locationId = main) =>
      (await service.variantBalances(tenant))
        .find((r) => r.variant === variant && r.locationId === locationId)
        ?.quantity.toString();

    describe('variant stock', () => {
      it('creates a variant on stock in and tracks it beside the item total', async () => {
        await receive('10', 'Red');
        await receive('5', 'Blue');
        await receive('2');
        expect(await total()).toBe('17');
        expect(await ofVariant('Red')).toBe('10');
        expect(await ofVariant('Blue')).toBe('5');
        expect((await service.listVariants(tenant, shirt)).map((v) => v.name)).toEqual([
          'Blue',
          'Red',
        ]);
        const movement = (await service.movements(tenant)).find((m) => m.variant === 'Red');
        expect(movement?.variantId).toBeTruthy();
      });
      it('takes stock out of the named variant only', async () => {
        await receive('10', 'Red');
        await receive('5', 'Blue');
        await issue('4', 'Red');
        expect(await ofVariant('Red')).toBe('6');
        expect(await ofVariant('Blue')).toBe('5');
        expect(await total()).toBe('11');
      });
      it('refuses to issue more of a variant than it holds, even if the item has enough', async () => {
        await receive('3', 'Red');
        await receive('10', 'Blue');
        await expect(issue('4', 'Red')).rejects.toBeInstanceOf(ConflictException);
        expect(await ofVariant('Red')).toBe('3');
        expect(await total()).toBe('13');
      });
      it('keeps untagged issues to the stock no variant accounts for', async () => {
        await receive('3', 'Red');
        await receive('2');
        await expect(issue('3')).rejects.toBeInstanceOf(ConflictException);
        await issue('2');
        expect(await total()).toBe('3');
        expect(await ofVariant('Red')).toBe('3');
      });
      it('does not create a variant on anything but stock in', async () => {
        await receive('5');
        await expect(issue('1', 'Green')).rejects.toBeInstanceOf(NotFoundException);
      });
      it('moves a variant between locations on transfer', async () => {
        await receive('10', 'Red');
        await service.transferBatch(tenant, 'user-a', {
          sourceLocationId: main,
          destinationLocationId: branch,
          date,
          lines: [{ itemId: shirt, quantity: '4', variant: 'Red' }],
        });
        expect(await ofVariant('Red', main)).toBe('6');
        expect(await ofVariant('Red', branch)).toBe('4');
        expect(await total(branch)).toBe('4');
      });
      it('adjusts a variant up and down', async () => {
        await receive('10', 'Red');
        const adjust = (type: StockAdjustmentType, quantity: string) =>
          service.adjustBatch(tenant, 'user-a', {
            locationId: main,
            type,
            reason: 'DAMAGE',
            date,
            lines: [{ itemId: shirt, quantity, variant: 'Red' }],
          });
        await adjust(StockAdjustmentType.DECREASE, '3');
        await adjust(StockAdjustmentType.INCREASE, '1');
        expect(await ofVariant('Red')).toBe('8');
        expect(await total()).toBe('8');
        await expect(adjust(StockAdjustmentType.DECREASE, '9')).rejects.toBeInstanceOf(
          ConflictException,
        );
      });
      it('rolls back the whole batch when one variant line is short', async () => {
        await receive('2', 'Red');
        await expect(
          service.stockOutBatch(tenant, 'user-a', {
            locationId: main,
            date,
            purpose: 'SALE' as never,
            lines: [
              { itemId: shirt, quantity: '1', variant: 'Red' },
              { itemId: shirt, quantity: '5', variant: 'Red' },
            ],
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(await ofVariant('Red')).toBe('2');
        expect(await total()).toBe('2');
      });
      it('cannot delete a variant that has stock history', async () => {
        await receive('2', 'Red');
        const [variant] = await service.listVariants(tenant, shirt);
        await expect(service.deleteVariant(tenant, variant.id)).rejects.toBeInstanceOf(
          ConflictException,
        );
      });
    });

    describe('subcategories', () => {
      it('lets an item take a subcategory of its own category only', async () => {
        const own = await service.createSubcategory(tenant, { categoryId, name: 'Tops' });
        const other = await service.createCategory(tenant, { name: 'Shoes' });
        const foreign = await service.createSubcategory(tenant, {
          categoryId: other.id,
          name: 'Boots',
        });
        await service.updateItem(tenant, shirt, { subcategoryId: own.id });
        expect((await service.getItem(tenant, shirt)).subcategoryId).toBe(own.id);
        await expect(
          service.updateItem(tenant, shirt, { subcategoryId: foreign.id }),
        ).rejects.toBeInstanceOf(ConflictException);
      });
      it('drops the subcategory when the item moves to another category', async () => {
        const own = await service.createSubcategory(tenant, { categoryId, name: 'Tops' });
        await service.updateItem(tenant, shirt, { subcategoryId: own.id });
        const other = await service.createCategory(tenant, { name: 'Shoes' });
        await service.updateItem(tenant, shirt, { categoryId: other.id });
        expect((await service.getItem(tenant, shirt)).subcategoryId).toBeNull();
      });
      it('rejects duplicate names within a category and deleting one in use', async () => {
        const own = await service.createSubcategory(tenant, { categoryId, name: 'Tops' });
        await expect(
          service.createSubcategory(tenant, { categoryId, name: 'Tops' }),
        ).rejects.toBeInstanceOf(ConflictException);
        await service.updateItem(tenant, shirt, { subcategoryId: own.id });
        await expect(service.deleteSubcategory(tenant, own.id)).rejects.toBeInstanceOf(
          ConflictException,
        );
      });
      it('reports how many items each subcategory has', async () => {
        const own = await service.createSubcategory(tenant, { categoryId, name: 'Tops' });
        await service.updateItem(tenant, shirt, { subcategoryId: own.id });
        expect(
          (await service.listSubcategories(tenant, categoryId)).map((s) => s.itemCount),
        ).toEqual([1]);
      });
    });

    describe('customers and suppliers', () => {
      it('keeps a customer and a supplier of the same name apart, but not two of one kind', async () => {
        await service.createParty(tenant, { kind: 'CUSTOMER' as never, name: 'Acme' });
        await service.createParty(tenant, { kind: 'SUPPLIER' as never, name: 'Acme' });
        await expect(
          service.createParty(tenant, { kind: 'CUSTOMER' as never, name: 'Acme' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(await service.listParties(tenant, 'SUPPLIER' as never)).toHaveLength(1);
        expect(await service.listParties(tenant)).toHaveLength(2);
      });
      it('isolates tenants', async () => {
        const party = await service.createParty(tenant, {
          kind: 'CUSTOMER' as never,
          name: 'Acme',
        });
        await expect(service.getParty('other-' + tenant, party.id)).rejects.toBeInstanceOf(
          NotFoundException,
        );
      });
    });

    describe('adjustment reasons', () => {
      const adjustWith = (reason: string) =>
        service.adjust(tenant, 'user-a', {
          itemId: shirt,
          locationId: main,
          type: StockAdjustmentType.INCREASE,
          quantity: '1',
          reason,
          date,
        });
      it('offers the six built-in reasons to a company on first use', async () => {
        const codes = (await service.listReasons(tenant)).map((r) => r.code).sort();
        expect(codes).toEqual([
          'DAMAGE',
          'DATA_CORRECTION',
          'EXPIRED_GOODS',
          'LOSS',
          'PHYSICAL_COUNT_DIFFERENCE',
          'THEFT',
        ]);
      });
      it('accepts a built-in reason even before the list was opened', async () => {
        await adjustWith('DAMAGE');
        expect(await total()).toBe('1');
      });
      it('accepts a reason the company added, and refuses an unknown or inactive one', async () => {
        const added = await service.createReason(tenant, { name: 'Water damage' });
        expect(added.code).toBe('WATER_DAMAGE');
        await adjustWith('WATER_DAMAGE');
        await expect(adjustWith('NOT_A_REASON')).rejects.toBeInstanceOf(BadRequestException);
        await service.updateReason(tenant, added.id, { status: 'INACTIVE' as never });
        await expect(adjustWith('WATER_DAMAGE')).rejects.toBeInstanceOf(ConflictException);
      });
      it('does not let built-in reasons be renamed or deleted, or one in use be deleted', async () => {
        const [damage] = (await service.listReasons(tenant)).filter((r) => r.code === 'DAMAGE');
        await expect(
          service.updateReason(tenant, damage.id, { name: 'Broken' }),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(service.deleteReason(tenant, damage.id)).rejects.toBeInstanceOf(
          ConflictException,
        );
        const added = await service.createReason(tenant, { name: 'Spillage' });
        await adjustWith('SPILLAGE');
        await expect(service.deleteReason(tenant, added.id)).rejects.toBeInstanceOf(
          ConflictException,
        );
      });
    });
  },
);

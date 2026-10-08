import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollConfigurationService } from './payroll-configuration.service';
import { PrismaService } from '../prisma/prisma.service';

const TENANT = 'tenant-1';
const USER = 'user-1';

const component = (over: Record<string, unknown> = {}) => ({
  id: 'ss',
  code: 'SSNIT',
  name: 'SSNIT (employee)',
  kind: 'deduction',
  method: 'percent',
  enabled: true,
  role: 'employee_social_security',
  base: 'basic',
  rounding: 'cent',
  params: { rate: 5.5 },
  tags: { taxable: false, pensionable: false, reducesTaxable: true },
  ...over,
});

const dto = (over: Record<string, unknown> = {}) => ({
  name: 'Ghana monthly payroll',
  payslipType: 'monthly' as const,
  components: [component()],
  effectiveFrom: '2026-10-01',
  note: 'First',
  ...over,
});

const versionRow = (
  version: number,
  effectiveFrom: string,
  components: unknown,
) => ({
  id: `v${version}`,
  tenantId: TENANT,
  configurationId: 'cfg-1',
  version,
  effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
  note: `note ${version}`,
  components,
  createdBy: USER,
  createdAt: new Date('2026-10-01T09:00:00.000Z'),
});

const configRow = (
  versions: ReturnType<typeof versionRow>[],
  payslipType = 'MONTHLY',
) => ({
  id: 'cfg-1',
  tenantId: TENANT,
  name: 'Ghana monthly payroll',
  payslipType,
  createdBy: USER,
  createdAt: new Date('2026-10-01T09:00:00.000Z'),
  updatedAt: new Date('2026-10-01T09:00:00.000Z'),
  versions,
});

function makePrisma() {
  const prisma = {
    payrollConfiguration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    payrollConfigurationVersion: { findFirst: jest.fn() },
    payrollSavedComponent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  return prisma;
}

describe('PayrollConfigurationService', () => {
  let service: PayrollConfigurationService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new PayrollConfigurationService(
      prisma as unknown as PrismaService,
    );
  });

  describe('list and get', () => {
    it('lists the tenant configurations with versions oldest first', async () => {
      prisma.payrollConfiguration.findMany.mockResolvedValue([
        configRow([
          versionRow(2, '2026-11-01', [component({ params: { rate: 6 } })]),
          versionRow(1, '2026-10-01', [component()]),
        ]),
      ]);

      const [view] = await service.list(TENANT);

      expect(prisma.payrollConfiguration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } }),
      );
      expect(view.payslipType).toBe('monthly');
      expect(view.versions.map((v) => v.version)).toEqual([1, 2]);
      expect(view.versions[0].effectiveFrom).toBe('2026-10-01');
    });

    it('404s for another tenant or an unknown id', async () => {
      prisma.payrollConfiguration.findFirst.mockResolvedValue(null);
      await expect(service.get(TENANT, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.payrollConfiguration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'nope', tenantId: TENANT } }),
      );
    });
  });

  describe('create', () => {
    it('creates version 1 and leaves other configurations of the same type alone', async () => {
      prisma.payrollConfiguration.create.mockImplementation(async ({ data }) =>
        configRow([
          versionRow(1, '2026-10-01', data.versions.create.components),
        ]),
      );

      const result = await service.create(TENANT, USER, dto());

      expect(prisma.payrollConfiguration.updateMany).not.toHaveBeenCalled();
      const data = prisma.payrollConfiguration.create.mock.calls[0][0].data;
      expect(data.payslipType).toBe('MONTHLY');
      expect(data.versions.create).toMatchObject({
        tenantId: TENANT,
        version: 1,
        note: 'First',
        createdBy: USER,
      });
      expect(result.published).toBe(true);
    });

    it('needs an effective date', async () => {
      await expect(
        service.create(TENANT, USER, dto({ effectiveFrom: undefined })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("refuses what the engine's own checks refuse", async () => {
      // A commission payslip needs an earning built from the commission figure.
      const error = await service
        .create(TENANT, USER, dto({ payslipType: 'commission' }))
        .catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(error.getResponse())).toContain(
        'commission figure',
      );
      expect(prisma.payrollConfiguration.create).not.toHaveBeenCalled();
    });

    it('refuses a component code that is a built-in name', async () => {
      const error = await service
        .create(
          TENANT,
          USER,
          dto({
            components: [
              component({
                id: 'c',
                code: 'COMMISSION',
                name: 'Sales',
                kind: 'earning',
                method: 'fixed',
                role: 'salary_wages',
                params: { amount: 10 },
              }),
            ],
          }),
        )
        .catch((e) => e);
      expect(JSON.stringify(error.getResponse())).toContain('reserved');
    });

    it('rejects invalid components with the reasons', async () => {
      const error = await service
        .create(
          TENANT,
          USER,
          dto({ components: [component({ kind: 'bonus' })] }),
        )
        .catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(error.getResponse())).toContain('kind must be');
      expect(prisma.payrollConfiguration.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const existing = () =>
      configRow([versionRow(1, '2026-10-01', [component()])]);

    beforeEach(() => {
      prisma.payrollConfiguration.findFirst.mockResolvedValue(existing());
      prisma.payrollConfiguration.update.mockImplementation(async ({ data }) =>
        configRow([
          versionRow(1, '2026-10-01', [component()]),
          ...(data.versions
            ? [versionRow(2, '2026-11-01', data.versions.create.components)]
            : []),
        ]),
      );
    });

    it('publishes a new version when the components changed', async () => {
      const result = await service.update(
        TENANT,
        USER,
        'cfg-1',
        dto({
          components: [component({ params: { rate: 6 } })],
          effectiveFrom: '2026-11-01',
          note: 'Rate rise',
          baseVersion: 1,
        }),
      );

      const data = prisma.payrollConfiguration.update.mock.calls[0][0].data;
      expect(data.versions.create).toMatchObject({
        version: 2,
        note: 'Rate rise',
        tenantId: TENANT,
      });
      expect(result.published).toBe(true);
      expect(result.versions).toHaveLength(2);
    });

    it('only updates the name when the components are the same', async () => {
      const result = await service.update(
        TENANT,
        USER,
        'cfg-1',
        dto({ name: 'Renamed', effectiveFrom: undefined, baseVersion: 1 }),
      );

      const data = prisma.payrollConfiguration.update.mock.calls[0][0].data;
      expect(data.name).toBe('Renamed');
      expect(data.versions).toBeUndefined();
      expect(result.published).toBe(false);
    });

    it('treats the same settings in a different key order as unchanged', async () => {
      const { tags, params, ...rest } = component();
      const reordered = {
        tags: { reducesTaxable: true, pensionable: false, taxable: false },
        params,
        ...rest,
      };
      void tags;
      await service.update(
        TENANT,
        USER,
        'cfg-1',
        dto({
          components: [reordered],
          effectiveFrom: undefined,
        }),
      );
      expect(
        prisma.payrollConfiguration.update.mock.calls[0][0].data.versions,
      ).toBeUndefined();
    });

    it('needs a date for a changed version, and not before the previous one', async () => {
      const changed = [component({ params: { rate: 6 } })];
      await expect(
        service.update(
          TENANT,
          USER,
          'cfg-1',
          dto({ components: changed, effectiveFrom: undefined }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.update(
          TENANT,
          USER,
          'cfg-1',
          dto({ components: changed, effectiveFrom: '2026-09-30' }),
        ),
      ).rejects.toThrow(/can't take effect before the previous one/);
      expect(prisma.payrollConfiguration.update).not.toHaveBeenCalled();
    });

    it('refuses when a newer version was saved since it was opened', async () => {
      prisma.payrollConfiguration.findFirst.mockResolvedValue(
        configRow([
          versionRow(1, '2026-10-01', [component()]),
          versionRow(2, '2026-11-01', [component({ params: { rate: 6 } })]),
        ]),
      );
      await expect(
        service.update(TENANT, USER, 'cfg-1', dto({ baseVersion: 1 })),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('can change the payslip type without touching other configurations', async () => {
      await service.update(
        TENANT,
        USER,
        'cfg-1',
        dto({ payslipType: 'monthly_commission', effectiveFrom: undefined }),
      );
      expect(
        prisma.payrollConfiguration.update.mock.calls[0][0].data.payslipType,
      ).toBe('MONTHLY_COMMISSION');
      expect(prisma.payrollConfiguration.updateMany).not.toHaveBeenCalled();
    });

    it('404s for a configuration of another tenant', async () => {
      prisma.payrollConfiguration.findFirst.mockResolvedValue(null);
      await expect(
        service.update(TENANT, USER, 'other', dto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('versionInForce', () => {
    it('asks for the latest version of the configuration that has started', async () => {
      prisma.payrollConfigurationVersion.findFirst.mockResolvedValue(
        versionRow(2, '2026-07-01', [component()]),
      );

      const result = await service.versionInForce(
        TENANT,
        'cfg-1',
        '2026-10-06',
      );

      expect(prisma.payrollConfigurationVersion.findFirst).toHaveBeenCalledWith(
        {
          where: {
            tenantId: TENANT,
            configurationId: 'cfg-1',
            effectiveFrom: { lte: new Date('2026-10-06T00:00:00.000Z') },
          },
          orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
        },
      );
      expect(result).toMatchObject({ version: 2 });
    });

    it('returns null when no version has started', async () => {
      prisma.payrollConfigurationVersion.findFirst.mockResolvedValue(null);
      expect(
        await service.versionInForce(TENANT, 'cfg-1', '2020-01-01'),
      ).toBeNull();
    });
  });

  describe('saved components', () => {
    const saved = (name = 'Transport') => ({
      id: 'sc-1',
      tenantId: TENANT,
      name,
      component: { code: 'TRANSPORT' },
      createdBy: USER,
      createdAt: new Date('2026-10-01T09:00:00.000Z'),
      updatedAt: new Date('2026-10-01T09:00:00.000Z'),
    });

    it('lists only the tenant ones', async () => {
      prisma.payrollSavedComponent.findMany.mockResolvedValue([saved()]);
      const result = await service.listSavedComponents(TENANT);
      expect(prisma.payrollSavedComponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } }),
      );
      expect(result[0].name).toBe('Transport');
    });

    it('stores a component without its id, enabled flag or links', async () => {
      prisma.payrollSavedComponent.create.mockResolvedValue(saved());
      await service.createSavedComponent(TENANT, USER, {
        name: 'SSNIT',
        component: component({ reduces: 'x', sourceTemplateId: 'old' }),
      });

      const stored =
        prisma.payrollSavedComponent.create.mock.calls[0][0].data.component;
      expect(stored).not.toHaveProperty('id');
      expect(stored).not.toHaveProperty('enabled');
      expect(stored).not.toHaveProperty('reduces');
      expect(stored).not.toHaveProperty('sourceTemplateId');
      expect(stored.code).toBe('SSNIT');
    });

    it('rejects an invalid component', async () => {
      await expect(
        service.createSavedComponent(TENANT, USER, {
          name: 'Bad',
          component: component({ method: 'magic' }),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("404s when replacing or deleting another tenant's component", async () => {
      prisma.payrollSavedComponent.findFirst.mockResolvedValue(null);
      await expect(
        service.replaceSavedComponent(TENANT, 'x', {
          name: 'n',
          component: component(),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.deleteSavedComponent(TENANT, 'x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.payrollSavedComponent.delete).not.toHaveBeenCalled();
    });

    it('deletes a tenant component', async () => {
      prisma.payrollSavedComponent.findFirst.mockResolvedValue(saved());
      expect(await service.deleteSavedComponent(TENANT, 'sc-1')).toEqual({
        deleted: true,
      });
      expect(prisma.payrollSavedComponent.delete).toHaveBeenCalledWith({
        where: { id: 'sc-1' },
      });
    });
  });
});

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_CURRENCY,
  checkConfiguration,
  type PayComponent,
} from '@work-phelo/payroll-engine';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollPayslipType, Prisma } from '../../prisma/generated/client';
import {
  type PayComponentData,
  type PayslipTypeKey,
} from './payroll-configuration.constants';
import { validateComponents } from './payroll-configuration.validation';
import { SavePayrollConfigurationDto } from './dto/save-payroll-configuration.dto';
import { SavePayrollSavedComponentDto } from './dto/save-payroll-saved-component.dto';

const TYPE_TO_ENUM: Record<PayslipTypeKey, PayrollPayslipType> = {
  monthly: PayrollPayslipType.MONTHLY,
  commission: PayrollPayslipType.COMMISSION,
  monthly_commission: PayrollPayslipType.MONTHLY_COMMISSION,
};
const ENUM_TO_TYPE: Record<PayrollPayslipType, PayslipTypeKey> = {
  MONTHLY: 'monthly',
  COMMISSION: 'commission',
  MONTHLY_COMMISSION: 'monthly_commission',
};

type ConfigurationRow = Prisma.PayrollConfigurationGetPayload<{
  include: { versions: true };
}>;
type VersionRow = ConfigurationRow['versions'][number];

export interface ConfigurationVersionView {
  version: number;
  effectiveFrom: string;
  note: string;
  savedAt: string;
  components: PayComponentData[];
}

export interface ConfigurationView {
  id: string;
  name: string;
  payslipType: PayslipTypeKey | null;
  currency: string;
  /** Oldest first. */
  versions: ConfigurationVersionView[];
}

export interface SavedComponentView {
  id: string;
  name: string;
  savedAt: string;
  component: Omit<PayComponentData, 'id' | 'enabled'>;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** JSON with sorted keys, so the same settings always compare equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function toVersionView(row: VersionRow): ConfigurationVersionView {
  return {
    version: row.version,
    effectiveFrom: isoDate(row.effectiveFrom),
    note: row.note,
    savedAt: row.createdAt.toISOString(),
    components: row.components as unknown as PayComponentData[],
  };
}

function toView(row: ConfigurationRow): ConfigurationView {
  return {
    id: row.id,
    name: row.name,
    payslipType: row.payslipType ? ENUM_TO_TYPE[row.payslipType] : null,
    currency: row.currency,
    versions: [...row.versions]
      .sort((a, b) => a.version - b.version)
      .map(toVersionView),
  };
}

@Injectable()
export class PayrollConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Configurations ───────────────────────────────────────────────────────

  async list(tenantId: string): Promise<ConfigurationView[]> {
    const rows = await this.prisma.payrollConfiguration.findMany({
      where: { tenantId },
      include: { versions: { orderBy: { version: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toView);
  }

  async get(tenantId: string, id: string): Promise<ConfigurationView> {
    return toView(await this.findOrThrow(tenantId, id));
  }

  async create(
    tenantId: string,
    userId: string,
    dto: SavePayrollConfigurationDto,
  ): Promise<ConfigurationView & { published: true }> {
    const components = this.checkedComponents(dto.components, dto.payslipType);
    if (!dto.effectiveFrom) {
      throw new BadRequestException(
        'Choose the date the configuration takes effect from.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.payrollConfiguration.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          payslipType: TYPE_TO_ENUM[dto.payslipType],
          currency: dto.currency ?? DEFAULT_CURRENCY,
          createdBy: userId,
          versions: {
            create: {
              tenantId,
              version: 1,
              effectiveFrom: toDate(dto.effectiveFrom!),
              note: dto.note?.trim() || 'Initial version',
              components: components as unknown as Prisma.InputJsonValue,
              createdBy: userId,
            },
          },
        },
        include: { versions: true },
      });
    });
    return { ...toView(created), published: true };
  }

  /**
   * Saves a configuration. Changed components publish a new version with its own effective date;
   * with no component changes only the name, payslip type and currency are updated.
   */
  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: SavePayrollConfigurationDto,
  ): Promise<ConfigurationView & { published: boolean }> {
    const components = this.checkedComponents(dto.components, dto.payslipType);
    const existing = await this.findOrThrow(tenantId, id);
    const latest = [...existing.versions].sort(
      (a, b) => b.version - a.version,
    )[0];

    if (dto.baseVersion !== undefined && dto.baseVersion !== latest.version) {
      throw new ConflictException(
        `Someone saved version ${latest.version} since you opened this configuration. Reload it and apply your changes again.`,
      );
    }

    const changed =
      canonical(latest.components) !== canonical(components as unknown);
    if (changed) {
      if (!dto.effectiveFrom) {
        throw new BadRequestException(
          'Choose the date the new version takes effect from.',
        );
      }
      if (dto.effectiveFrom < isoDate(latest.effectiveFrom)) {
        throw new BadRequestException(
          `A new version can't take effect before the previous one (${isoDate(latest.effectiveFrom)}).`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.payrollConfiguration.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          payslipType: TYPE_TO_ENUM[dto.payslipType],
          ...(dto.currency ? { currency: dto.currency } : {}),
          ...(changed
            ? {
                versions: {
                  create: {
                    tenantId,
                    version: latest.version + 1,
                    effectiveFrom: toDate(dto.effectiveFrom!),
                    note: dto.note?.trim() ?? '',
                    components: components as unknown as Prisma.InputJsonValue,
                    createdBy: userId,
                  },
                },
              }
            : {}),
        },
        include: { versions: true },
      });
    });
    return { ...toView(updated), published: changed };
  }

  /**
   * The version of a configuration a payroll run dated `date` uses: the latest one that has
   * started by then. Null when none has started yet. A payroll group names its configuration, so
   * the lookup is by configuration, not by payslip type.
   */
  async versionInForce(
    tenantId: string,
    configurationId: string,
    date: string,
  ): Promise<ConfigurationVersionView | null> {
    const row = await this.prisma.payrollConfigurationVersion.findFirst({
      where: {
        tenantId,
        configurationId,
        effectiveFrom: { lte: toDate(date) },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });
    return row ? toVersionView(row) : null;
  }

  // ── Saved components ─────────────────────────────────────────────────────

  async listSavedComponents(tenantId: string): Promise<SavedComponentView[]> {
    const rows = await this.prisma.payrollSavedComponent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toSavedView(row));
  }

  async createSavedComponent(
    tenantId: string,
    userId: string,
    dto: SavePayrollSavedComponentDto,
  ): Promise<SavedComponentView> {
    const component = this.checkedSavedComponent(dto.component);
    const row = await this.prisma.payrollSavedComponent.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        component: component as unknown as Prisma.InputJsonValue,
        createdBy: userId,
      },
    });
    return this.toSavedView(row);
  }

  async replaceSavedComponent(
    tenantId: string,
    id: string,
    dto: SavePayrollSavedComponentDto,
  ): Promise<SavedComponentView> {
    await this.findSavedOrThrow(tenantId, id);
    const component = this.checkedSavedComponent(dto.component);
    const row = await this.prisma.payrollSavedComponent.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        component: component as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toSavedView(row);
  }

  async deleteSavedComponent(tenantId: string, id: string) {
    await this.findSavedOrThrow(tenantId, id);
    await this.prisma.payrollSavedComponent.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Cleans the components, then runs the payroll engine's own checks on them: the same ones the
   * page runs before it lets someone save, so the server refuses what the page would (calculation
   * loops, reserved codes, a commission payslip that nothing is built on, and so on).
   */
  private checkedComponents(
    input: unknown[],
    payslipType: PayslipTypeKey,
  ): PayComponentData[] {
    const { components, errors } = validateComponents(input);
    if (errors.length) throw new BadRequestException(errors);
    const { errors: engineErrors } = checkConfiguration(
      components as unknown as PayComponent[],
      payslipType,
    );
    if (engineErrors.length) throw new BadRequestException(engineErrors);
    return components;
  }

  private checkedSavedComponent(
    input: Record<string, unknown>,
  ): Omit<PayComponentData, 'id' | 'enabled'> {
    // A saved component has no place in a configuration yet, so it gets a placeholder id to pass
    // the same checks, which is then dropped again.
    const { components, errors } = validateComponents(
      [{ ...input, id: 'saved', enabled: true }],
      { standalone: true },
    );
    if (errors.length) throw new BadRequestException(errors);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, enabled, sourceTemplateId, ...rest } = components[0];
    return rest;
  }

  private async findOrThrow(tenantId: string, id: string) {
    const row = await this.prisma.payrollConfiguration.findFirst({
      where: { id, tenantId },
      include: { versions: true },
    });
    if (!row) throw new NotFoundException('Payroll configuration not found');
    return row;
  }

  private async findSavedOrThrow(tenantId: string, id: string) {
    const row = await this.prisma.payrollSavedComponent.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Saved component not found');
    return row;
  }

  private toSavedView(
    row: Prisma.PayrollSavedComponentGetPayload<object>,
  ): SavedComponentView {
    return {
      id: row.id,
      name: row.name,
      savedAt: row.createdAt.toISOString(),
      component: row.component as unknown as SavedComponentView['component'],
    };
  }
}

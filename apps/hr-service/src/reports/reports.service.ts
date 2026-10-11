import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { hasPermissionRule, isCompanyAdminUser } from '../auth/access-scope';
import {
  REPORT_DATASETS,
  REPORT_ROW_CAP,
  ReportPeriod,
} from './report-catalog';
import {
  AGGREGATIONS,
  CHART_TYPES,
  GRANULARITIES,
  MAX_BLOCKS_PER_REPORT,
  MAX_CHART_MEASURES,
  ReportBlock,
  ReportType,
  describeCatalog,
  runBlock,
  validateBlock,
} from './report-engine';
import { ReportPeriodDto } from './dto/report-period.dto';
import { RunReportDto } from './dto/run-report.dto';
import { SaveReportDto } from './dto/save-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

/** What is stored in `SavedReport.definition`. */
interface ReportDefinition {
  period: ReportPeriodDto | null;
  blocks: ReportBlock[];
}

const SAVED_SUMMARY = {
  id: true,
  name: true,
  description: true,
  type: true,
  createdBy: true,
  createdByName: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything the builder form is made from: datasets, fields, and what each can be used for. */
  getCatalog(user: RequestUser) {
    return {
      datasets: describeCatalog(REPORT_DATASETS, this.canUse(user)),
      chartTypes: CHART_TYPES,
      aggregations: AGGREGATIONS,
      granularities: GRANULARITIES,
      maxChartMeasures: MAX_CHART_MEASURES,
      maxBlocksPerReport: MAX_BLOCKS_PER_REPORT,
    };
  }

  async run(user: RequestUser, dto: RunReportDto) {
    const block = dto.block as ReportBlock;
    const dataset = validateBlock(block, dto.type, this.canUse(user));
    const period = this.toPeriod(dto.period);

    const rows = await dataset.load(this.prisma, user.tenantId, period);
    return runBlock(dataset, rows, block, {
      page: dto.page,
      pageSize: dto.pageSize,
      truncated: rows.length >= REPORT_ROW_CAP,
    });
  }

  // ── Saved reports ─────────────────────────────────────────────────────────

  /** Saved reports are shared: everyone who can open the reports page sees all of them. */
  listSaved(tenantId: string) {
    return this.prisma.savedReport.findMany({
      where: { tenantId },
      select: SAVED_SUMMARY,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSaved(tenantId: string, id: string) {
    const report = await this.prisma.savedReport.findFirst({
      where: { id, tenantId },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async createSaved(user: RequestUser, dto: SaveReportDto) {
    this.validateDefinition(user, dto.type, dto.blocks as ReportBlock[]);
    await this.assertNameFree(user.tenantId, dto.name);

    try {
      return await this.prisma.savedReport.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          type: dto.type,
          definition: this.toDefinition(dto.period, dto.blocks),
          createdBy: user.id,
          createdByName: user.firstName || user.email,
        },
      });
    } catch (error) {
      throw this.nameClash(error);
    }
  }

  async updateSaved(user: RequestUser, id: string, dto: UpdateReportDto) {
    const existing = await this.getSaved(user.tenantId, id);
    this.assertCanChange(user, existing.createdBy);

    const current = existing.definition as unknown as ReportDefinition;
    const type = (dto.type ?? existing.type) as ReportType;
    const blocks: ReportBlock[] = dto.blocks ?? current.blocks;
    const period = dto.period !== undefined ? dto.period : current.period;

    // Re-checked as a whole: changing the type alone would otherwise leave blocks that don't fit.
    this.validateDefinition(user, type, blocks);
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameFree(user.tenantId, dto.name, id);
    }

    try {
      return await this.prisma.savedReport.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          type,
          definition: this.toDefinition(period ?? undefined, blocks),
        },
      });
    } catch (error) {
      throw this.nameClash(error);
    }
  }

  async deleteSaved(user: RequestUser, id: string) {
    const existing = await this.getSaved(user.tenantId, id);
    this.assertCanChange(user, existing.createdBy);
    await this.prisma.savedReport.delete({ where: { id } });
    return { message: 'Report deleted' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Admins pass every rule; everyone else needs it among their permission rules. */
  private canUse(user: RequestUser) {
    return (rule: string) =>
      isCompanyAdminUser(user) || hasPermissionRule(user, rule);
  }

  /** Anyone with access may open a saved report; only its author (or an admin) may change it. */
  private assertCanChange(user: RequestUser, createdBy: string) {
    if (isCompanyAdminUser(user) || user.id === createdBy) return;
    throw new ForbiddenException(
      'Only the person who saved this report can change it.',
    );
  }

  private validateDefinition(
    user: RequestUser,
    type: ReportType,
    blocks: ReportBlock[],
  ) {
    if (type === 'TABLE' && blocks.length !== 1) {
      throw new BadRequestException('A table report has exactly one table.');
    }
    const canUse = this.canUse(user);
    for (const block of blocks) validateBlock(block, type, canUse);
  }

  private toDefinition(
    period: ReportPeriodDto | undefined,
    blocks: ReportBlock[] | SaveReportDto['blocks'],
  ) {
    const definition: ReportDefinition = {
      period: period ?? null,
      blocks: blocks as ReportBlock[],
    };
    return definition as unknown as Prisma.InputJsonValue;
  }

  private toPeriod(period?: ReportPeriodDto): ReportPeriod {
    const from = period?.from ? new Date(period.from) : undefined;
    const to = period?.to ? new Date(period.to) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException('The period starts after it ends.');
    }
    if (to) to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  private async assertNameFree(tenantId: string, name: string, ownId?: string) {
    const clash = await this.prisma.savedReport.findFirst({
      where: {
        tenantId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(ownId ? { id: { not: ownId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException('Another report already has that name.');
    }
  }

  /** Two requests racing past the check still hit the database's own unique name rule. */
  private nameClash(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Another report already has that name.');
    }
    return error;
  }
}

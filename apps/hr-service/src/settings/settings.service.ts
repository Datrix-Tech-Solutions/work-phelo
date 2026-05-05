import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmploymentStatus } from '../../prisma/generated/client';

const DEFAULT_NOTICE_PERIOD_DAYS = 30;
const DEFAULT_PAYROLL_TIER3_ENABLED = false;
const DEFAULT_PAYROLL_TIER3_RATE: number | null = null;
const DEFAULT_PAYROLL_TIER3_SCHEME_NAME: string | null = null;
const DEFAULT_APPRAISAL_THRESHOLDS = {
  outstandingThreshold: 90,
  veryGoodThreshold: 80,
  goodThreshold: 70,
  satisfactoryThreshold: 60,
};
const DEFAULT_APPRAISAL_ELIGIBLE_STATUSES = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
] as const;
const APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION,
  EmploymentStatus.SUSPENDED,
] as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeAppraisalEligibleStatuses(
    statuses?: string[] | null,
  ): EmploymentStatus[] {
    const allowed = new Set(APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES);
    const normalized = Array.from(new Set(statuses ?? [])).filter((status) =>
      allowed.has(
        status as (typeof APPRAISAL_ELIGIBLE_EMPLOYMENT_STATUSES)[number],
      ),
    ) as EmploymentStatus[];

    return normalized.length
      ? normalized
      : [...DEFAULT_APPRAISAL_ELIGIBLE_STATUSES];
  }

  async getResignationSettings(
    tenantId: string,
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    if (adminUserId || adminEmail) {
      await this.prisma.tenantConfig.updateMany({
        where: {
          tenantId,
          OR: [
            ...(adminUserId ? [{ adminUserId: null }] : []),
            ...(adminEmail ? [{ adminEmail: '' }] : []),
          ],
        },
        data: {
          ...(adminUserId ? { adminUserId } : {}),
          ...(adminEmail ? { adminEmail } : {}),
        },
      });
    }

    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { resignationNoticePeriodDays: true },
    });

    return {
      resignationNoticePeriodDays:
        config?.resignationNoticePeriodDays ?? DEFAULT_NOTICE_PERIOD_DAYS,
    };
  }

  async getAttendanceSettings(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { lateArrivalThresholdMinutes: true },
    });
    return {
      lateArrivalThresholdMinutes: config?.lateArrivalThresholdMinutes ?? 0,
    };
  }

  async getPayrollSettings(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        payrollTier3Enabled: true,
        payrollTier3Rate: true,
        payrollTier3SchemeName: true,
      },
    });

    return {
      payrollTier3Enabled:
        config?.payrollTier3Enabled ?? DEFAULT_PAYROLL_TIER3_ENABLED,
      payrollTier3Rate:
        config?.payrollTier3Rate != null
          ? Number(config.payrollTier3Rate.toString())
          : DEFAULT_PAYROLL_TIER3_RATE,
      payrollTier3SchemeName:
        config?.payrollTier3SchemeName ?? DEFAULT_PAYROLL_TIER3_SCHEME_NAME,
    };
  }

  async getAppraisalSettings(tenantId: string) {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        appraisalEligibleStatuses: true,
        outstandingThreshold: true,
        veryGoodThreshold: true,
        goodThreshold: true,
        satisfactoryThreshold: true,
      },
    });

    return {
      appraisalEligibleStatuses: this.normalizeAppraisalEligibleStatuses(
        config?.appraisalEligibleStatuses,
      ),
      outstandingThreshold:
        config?.outstandingThreshold ??
        DEFAULT_APPRAISAL_THRESHOLDS.outstandingThreshold,
      veryGoodThreshold:
        config?.veryGoodThreshold ??
        DEFAULT_APPRAISAL_THRESHOLDS.veryGoodThreshold,
      goodThreshold:
        config?.goodThreshold ?? DEFAULT_APPRAISAL_THRESHOLDS.goodThreshold,
      satisfactoryThreshold:
        config?.satisfactoryThreshold ??
        DEFAULT_APPRAISAL_THRESHOLDS.satisfactoryThreshold,
    };
  }

  async updateAttendanceSettings(
    tenantId: string,
    lateArrivalThresholdMinutes: number,
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        lateArrivalThresholdMinutes,
      },
      update: {
        lateArrivalThresholdMinutes,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: { lateArrivalThresholdMinutes: true },
    });
    return {
      message: 'Attendance settings updated successfully',
      lateArrivalThresholdMinutes: config.lateArrivalThresholdMinutes,
    };
  }

  async updateResignationSettings(
    tenantId: string,
    resignationNoticePeriodDays: number,
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        resignationNoticePeriodDays,
      },
      update: {
        resignationNoticePeriodDays,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: { resignationNoticePeriodDays: true },
    });

    return {
      message: 'Resignation settings updated successfully',
      resignationNoticePeriodDays: config.resignationNoticePeriodDays,
    };
  }

  async updatePayrollSettings(
    tenantId: string,
    payrollSettings: {
      payrollTier3Enabled?: boolean;
      payrollTier3Rate?: number;
      payrollTier3SchemeName?: string;
    },
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    const tier3Enabled =
      payrollSettings.payrollTier3Enabled ?? DEFAULT_PAYROLL_TIER3_ENABLED;
    const normalizedTier3Rate =
      payrollSettings.payrollTier3Rate == null
        ? null
        : Number(payrollSettings.payrollTier3Rate);
    const normalizedTier3SchemeName =
      payrollSettings.payrollTier3SchemeName?.trim() || null;

    if (tier3Enabled) {
      if (normalizedTier3Rate == null) {
        throw new BadRequestException(
          'Tier 3 rate is required when Tier 3 payroll support is enabled.',
        );
      }

      if (!normalizedTier3SchemeName) {
        throw new BadRequestException(
          'Tier 3 scheme name is required when Tier 3 payroll support is enabled.',
        );
      }
    }

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        payrollTier3Enabled: tier3Enabled,
        payrollTier3Rate: tier3Enabled ? normalizedTier3Rate : null,
        payrollTier3SchemeName: tier3Enabled ? normalizedTier3SchemeName : null,
      },
      update: {
        payrollTier3Enabled: tier3Enabled,
        payrollTier3Rate: tier3Enabled ? normalizedTier3Rate : null,
        payrollTier3SchemeName: tier3Enabled ? normalizedTier3SchemeName : null,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: {
        payrollTier3Enabled: true,
        payrollTier3Rate: true,
        payrollTier3SchemeName: true,
      },
    });

    return {
      message: 'Payroll settings updated successfully',
      payrollTier3Enabled: config.payrollTier3Enabled,
      payrollTier3Rate:
        config.payrollTier3Rate != null
          ? Number(config.payrollTier3Rate.toString())
          : null,
      payrollTier3SchemeName: config.payrollTier3SchemeName,
    };
  }

  async updateAppraisalSettings(
    tenantId: string,
    thresholds: {
      outstandingThreshold: number;
      veryGoodThreshold: number;
      goodThreshold: number;
      satisfactoryThreshold: number;
      appraisalEligibleStatuses: string[];
    },
    adminUserId?: string | null,
    adminEmail?: string | null,
  ) {
    if (
      !(
        thresholds.outstandingThreshold > thresholds.veryGoodThreshold &&
        thresholds.veryGoodThreshold > thresholds.goodThreshold &&
        thresholds.goodThreshold > thresholds.satisfactoryThreshold
      )
    ) {
      throw new BadRequestException(
        'Performance band thresholds must descend strictly from Outstanding to Satisfactory.',
      );
    }

    const appraisalEligibleStatuses = this.normalizeAppraisalEligibleStatuses(
      thresholds.appraisalEligibleStatuses,
    );
    const thresholdValues = {
      outstandingThreshold: thresholds.outstandingThreshold,
      veryGoodThreshold: thresholds.veryGoodThreshold,
      goodThreshold: thresholds.goodThreshold,
      satisfactoryThreshold: thresholds.satisfactoryThreshold,
    };

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        adminEmail: adminEmail ?? '',
        adminUserId: adminUserId ?? null,
        appraisalEligibleStatuses,
        ...thresholdValues,
      },
      update: {
        appraisalEligibleStatuses,
        ...thresholdValues,
        ...(adminUserId ? { adminUserId } : {}),
        ...(adminEmail ? { adminEmail } : {}),
      },
      select: {
        appraisalEligibleStatuses: true,
        outstandingThreshold: true,
        veryGoodThreshold: true,
        goodThreshold: true,
        satisfactoryThreshold: true,
      },
    });

    return {
      message: 'Appraisal settings updated successfully',
      ...config,
    };
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmploymentStatus } from '../../prisma/generated/client';

const DEFAULT_NOTICE_PERIOD_DAYS = 30;
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
    const { appraisalEligibleStatuses: _ignored, ...thresholdValues } =
      thresholds;

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

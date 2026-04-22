import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_NOTICE_PERIOD_DAYS = 30;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
}

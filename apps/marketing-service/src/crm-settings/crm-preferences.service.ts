import { Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_FOLLOW_UP_DELAY_DAYS,
  UpdateCrmPreferencesDto,
} from './dto/crm-preferences.dto';

@Injectable()
export class CrmPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const row = await this.prisma.marketingCrmPreference.findUnique({
      where: { tenantId },
    });
    return {
      followUpDelayDays: row?.followUpDelayDays ?? DEFAULT_FOLLOW_UP_DELAY_DAYS,
    };
  }

  async update(user: RequestUser, dto: UpdateCrmPreferencesDto) {
    const row = await this.prisma.marketingCrmPreference.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        followUpDelayDays: dto.followUpDelayDays,
        updatedByUserId: user.id,
      },
      update: {
        followUpDelayDays: dto.followUpDelayDays,
        updatedByUserId: user.id,
      },
    });
    return { followUpDelayDays: row.followUpDelayDays };
  }
}

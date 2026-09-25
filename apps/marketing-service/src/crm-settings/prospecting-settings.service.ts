import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCrmSettingCategory,
  MarketingCrmSettingOption,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProspectingSettingDto,
  QueryProspectingSettingsDto,
  UpdateProspectingSettingDto,
} from './dto/prospecting-setting.dto';

const DUPLICATE_MESSAGE =
  'A setting with this name already exists for this category';

@Injectable()
export class ProspectingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    category: MarketingCrmSettingCategory,
    query: QueryProspectingSettingsDto = {},
  ) {
    const where: Prisma.MarketingCrmSettingOptionWhereInput = {
      tenantId,
      category,
      archivedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const items = await this.prisma.marketingCrmSettingOption.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });

    return { items };
  }

  async findOne(
    tenantId: string,
    category: MarketingCrmSettingCategory,
    id: string,
  ): Promise<MarketingCrmSettingOption> {
    const setting = await this.prisma.marketingCrmSettingOption.findFirst({
      where: { id, tenantId, category, archivedAt: null },
    });

    if (!setting) throw new NotFoundException('CRM setting not found');
    return setting;
  }

  async create(
    user: RequestUser,
    category: MarketingCrmSettingCategory,
    dto: CreateProspectingSettingDto,
  ): Promise<MarketingCrmSettingOption> {
    const name = this.formatName(dto.name);
    const normalizedName = this.normalizeName(name);

    await this.assertNameAvailable(user.tenantId, category, normalizedName);

    try {
      return await this.prisma.marketingCrmSettingOption.create({
        data: {
          tenantId: user.tenantId,
          category,
          name,
          normalizedName,
          description: this.formatOptionalText(dto.description),
          displayOrder: dto.displayOrder ?? 0,
          isActive: dto.isActive ?? true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async update(
    user: RequestUser,
    category: MarketingCrmSettingCategory,
    id: string,
    dto: UpdateProspectingSettingDto,
  ): Promise<MarketingCrmSettingOption> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const existing = await this.findOne(user.tenantId, category, id);
    const name =
      dto.name !== undefined ? this.formatName(dto.name) : existing.name;
    const normalizedName =
      dto.name !== undefined
        ? this.normalizeName(name)
        : existing.normalizedName;

    if (dto.name !== undefined && normalizedName !== existing.normalizedName) {
      await this.assertNameAvailable(
        user.tenantId,
        category,
        normalizedName,
        id,
      );
    }

    try {
      return await this.prisma.marketingCrmSettingOption.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name, normalizedName } : {}),
          ...(dto.description !== undefined
            ? { description: this.formatOptionalText(dto.description) }
            : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async archive(
    user: RequestUser,
    category: MarketingCrmSettingCategory,
    id: string,
  ): Promise<MarketingCrmSettingOption> {
    await this.findOne(user.tenantId, category, id);

    return this.prisma.marketingCrmSettingOption.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        isActive: false,
        updatedByUserId: user.id,
      },
    });
  }

  private async assertNameAvailable(
    tenantId: string,
    category: MarketingCrmSettingCategory,
    normalizedName: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.marketingCrmSettingOption.findFirst({
      where: {
        tenantId,
        category,
        normalizedName,
        archivedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) throw new ConflictException(DUPLICATE_MESSAGE);
  }

  private formatName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  private normalizeName(name: string): string {
    return this.formatName(name).toLocaleLowerCase();
  }

  private formatOptionalText(value: string | undefined): string | null {
    if (value === undefined) return null;
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.length > 0 ? normalized : null;
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

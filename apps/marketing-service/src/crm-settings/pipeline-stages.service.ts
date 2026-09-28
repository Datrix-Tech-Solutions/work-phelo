import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingPipelineStage, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePipelineStageDto,
  QueryPipelineStagesDto,
  UpdatePipelineStageDto,
} from './dto/pipeline-stage.dto';

const DUPLICATE_MESSAGE =
  'A pipeline stage with this name already exists for this company';

@Injectable()
export class PipelineStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryPipelineStagesDto = {}) {
    const where: Prisma.MarketingPipelineStageWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const items = await this.prisma.marketingPipelineStage.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });

    return { items };
  }

  async findOne(tenantId: string, id: string): Promise<MarketingPipelineStage> {
    const stage = await this.prisma.marketingPipelineStage.findFirst({
      where: { id, tenantId, archivedAt: null },
    });

    if (!stage) throw new NotFoundException('Pipeline stage not found');
    return stage;
  }

  async create(
    user: RequestUser,
    dto: CreatePipelineStageDto,
  ): Promise<MarketingPipelineStage> {
    const name = this.formatName(dto.name);
    const normalizedName = this.normalizeName(name);

    await this.assertNameAvailable(user.tenantId, normalizedName);

    try {
      return await this.prisma.marketingPipelineStage.create({
        data: {
          tenantId: user.tenantId,
          name,
          normalizedName,
          probability: dto.probability,
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
    id: string,
    dto: UpdatePipelineStageDto,
  ): Promise<MarketingPipelineStage> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const existing = await this.findOne(user.tenantId, id);
    const name =
      dto.name !== undefined ? this.formatName(dto.name) : existing.name;
    const normalizedName =
      dto.name !== undefined
        ? this.normalizeName(name)
        : existing.normalizedName;

    if (dto.name !== undefined && normalizedName !== existing.normalizedName) {
      await this.assertNameAvailable(user.tenantId, normalizedName, id);
    }

    try {
      return await this.prisma.marketingPipelineStage.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name, normalizedName } : {}),
          ...(dto.probability !== undefined
            ? { probability: dto.probability }
            : {}),
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
    id: string,
  ): Promise<MarketingPipelineStage> {
    await this.findOne(user.tenantId, id);

    return this.prisma.marketingPipelineStage.update({
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
    normalizedName: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.marketingPipelineStage.findFirst({
      where: {
        tenantId,
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

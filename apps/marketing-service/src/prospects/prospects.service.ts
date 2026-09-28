import { BadRequestException, Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProspectDto,
  CreateProspectProductDto,
} from './dto/create-prospect.dto';

const INVALID_REFERENCE_MESSAGE = 'Invalid prospect reference';
const DUPLICATE_PRODUCT_MESSAGE =
  'A product or service can only be added once per prospect';

type SettingReference = {
  id: string | undefined;
  category: MarketingCrmSettingCategory;
};

@Injectable()
export class ProspectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: RequestUser, dto: CreateProspectDto) {
    this.assertUniqueProducts(dto.products);
    await this.assertReferences(user.tenantId, dto);

    return this.prisma.$transaction((tx) => {
      return tx.marketingProspect.create({
        data: {
          tenantId: user.tenantId,
          companyName: this.formatText(dto.companyName),
          normalizedCompanyName: this.normalizeText(dto.companyName),
          businessTypeId: dto.businessTypeId ?? null,
          sourceTypeId: dto.sourceTypeId ?? null,
          pipelineStageId: dto.pipelineStageId,
          assignedUserId: user.id,
          locationLabel: this.formatText(dto.location.label),
          latitude: dto.location.latitude,
          longitude: dto.location.longitude,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          contacts: {
            create: {
              tenantId: user.tenantId,
              name: this.formatText(dto.primaryContact.name),
              phone: this.formatOptionalText(dto.primaryContact.phone),
              email: this.formatOptionalText(dto.primaryContact.email),
              decisionMakerTypeId:
                dto.primaryContact.decisionMakerTypeId ?? null,
              isPrimary: true,
            },
          },
          products: {
            create: dto.products.map((product) =>
              this.toProductCreateInput(user.tenantId, product),
            ),
          },
          ...(dto.initialInteraction
            ? {
                interactions: {
                  create: {
                    tenantId: user.tenantId,
                    interactionMediumId:
                      dto.initialInteraction.interactionMediumId ?? null,
                    occurredAt: new Date(dto.initialInteraction.occurredAt),
                    notes: this.formatOptionalText(
                      dto.initialInteraction.notes,
                    ),
                    createdByUserId: user.id,
                  },
                },
              }
            : {}),
        },
        include: {
          contacts: true,
          products: true,
          interactions: true,
        },
      });
    });
  }

  private async assertReferences(tenantId: string, dto: CreateProspectDto) {
    await Promise.all([
      this.assertActivePipelineStage(tenantId, dto.pipelineStageId),
      ...this.settingReferences(dto).map((reference) =>
        this.assertActiveSetting(tenantId, reference),
      ),
    ]);
  }

  private settingReferences(dto: CreateProspectDto): SettingReference[] {
    return [
      {
        id: dto.businessTypeId,
        category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
      },
      {
        id: dto.sourceTypeId,
        category: MarketingCrmSettingCategory.SOURCE_TYPE,
      },
      {
        id: dto.primaryContact.decisionMakerTypeId,
        category: MarketingCrmSettingCategory.DECISION_MAKER,
      },
      {
        id: dto.initialInteraction?.interactionMediumId,
        category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
      },
      ...dto.products.map((product) => ({
        id: product.productId,
        category: MarketingCrmSettingCategory.PRODUCT,
      })),
    ];
  }

  private async assertActiveSetting(
    tenantId: string,
    reference: SettingReference,
  ) {
    if (!reference.id) return;

    const setting = await this.prisma.marketingCrmSettingOption.findFirst({
      where: {
        id: reference.id,
        tenantId,
        category: reference.category,
        archivedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!setting) throw new BadRequestException(INVALID_REFERENCE_MESSAGE);
  }

  private async assertActivePipelineStage(tenantId: string, id: string) {
    const stage = await this.prisma.marketingPipelineStage.findFirst({
      where: {
        id,
        tenantId,
        archivedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!stage) throw new BadRequestException(INVALID_REFERENCE_MESSAGE);
  }

  private assertUniqueProducts(products: CreateProspectProductDto[]) {
    const seen = new Set<string>();
    for (const product of products) {
      if (seen.has(product.productId)) {
        throw new BadRequestException(DUPLICATE_PRODUCT_MESSAGE);
      }
      seen.add(product.productId);
    }
  }

  private toProductCreateInput(
    tenantId: string,
    product: CreateProspectProductDto,
  ): Prisma.MarketingProspectProductCreateWithoutProspectInput {
    return {
      tenantId,
      productId: product.productId,
      expectedValue: product.expectedValue,
      achievedValue: product.achievedValue ?? null,
      commissionRate: product.commissionRate ?? null,
      commissionAmount: product.commissionAmount ?? null,
      expectedCloseDate: product.expectedCloseDate
        ? new Date(product.expectedCloseDate)
        : null,
    };
  }

  private formatText(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeText(value: string): string {
    return this.formatText(value).toLocaleLowerCase();
  }

  private formatOptionalText(value: string | undefined): string | null {
    if (value === undefined) return null;
    const normalized = this.formatText(value);
    return normalized.length > 0 ? normalized : null;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  BusinessClassFieldSection,
  BusinessClassFieldType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessClassDto } from './dto/create-business-class.dto';
import { CreateBusinessClassFieldDto } from './dto/create-business-class-field.dto';
import { QueryBusinessClassesDto } from './dto/query-business-classes.dto';
import { UpdateBusinessClassDto } from './dto/update-business-class.dto';
import { UpdateBusinessClassFieldDto } from './dto/update-business-class-field.dto';

const fieldOrderBy = [
  { section: 'asc' as const },
  { displayOrder: 'asc' as const },
  { fieldKey: 'asc' as const },
];

const businessClassInclude = {
  fields: { orderBy: fieldOrderBy },
} satisfies Prisma.BusinessClassInclude;

type BusinessClassRecord = Prisma.BusinessClassGetPayload<{
  include: typeof businessClassInclude;
}>;

@Injectable()
export class BusinessClassSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QueryBusinessClassesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BusinessClassWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.businessClass.findMany({
        where,
        include: businessClassInclude,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.businessClass.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<BusinessClassRecord> {
    const bc = await this.prisma.businessClass.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: businessClassInclude,
    });

    if (!bc) throw new NotFoundException('Business class not found');
    return bc;
  }

  async create(
    user: RequestUser,
    dto: CreateBusinessClassDto,
  ): Promise<BusinessClassRecord> {
    try {
      return await this.prisma.businessClass.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          code: dto.code,
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
          displayOrder: dto.displayOrder ?? 0,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: businessClassInclude,
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateBusinessClassDto,
  ): Promise<BusinessClassRecord> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    await this.assertExists(user.tenantId, id);

    try {
      return await this.prisma.businessClass.update({
        where: {
          id_tenantId: { id, tenantId: user.tenantId },
          archivedAt: null,
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          updatedByUserId: user.id,
        },
        include: businessClassInclude,
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async archive(user: RequestUser, id: string): Promise<BusinessClassRecord> {
    const bc = await this.assertExists(user.tenantId, id);

    const activePlacementCount = await this.prisma.placement.count({
      where: {
        tenantId: user.tenantId,
        classOfBusiness: bc.code,
        archivedAt: null,
      },
    });

    if (activePlacementCount > 0) {
      throw new BadRequestException(
        `Cannot archive business class '${bc.code}': ${activePlacementCount} active placement(s) reference it`,
      );
    }

    return this.prisma.businessClass.update({
      where: {
        id_tenantId: { id, tenantId: user.tenantId },
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        updatedByUserId: user.id,
      },
      include: businessClassInclude,
    });
  }

  async createField(
    user: RequestUser,
    businessClassId: string,
    dto: CreateBusinessClassFieldDto,
  ) {
    await this.assertExists(user.tenantId, businessClassId);
    this.assertSelectHasOptions(dto.fieldType, dto.options);

    try {
      return await this.prisma.businessClassField.create({
        data: {
          tenantId: user.tenantId,
          businessClassId,
          section: dto.section,
          fieldKey: dto.fieldKey,
          label: dto.label,
          fieldType: dto.fieldType,
          required: dto.required ?? false,
          options: dto.options
            ? (dto.options as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          validationRules: dto.validationRules
            ? (dto.validationRules as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          placeholder: dto.placeholder?.trim() || null,
          helpText: dto.helpText?.trim() || null,
          displayOrder: dto.displayOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Field key '${dto.fieldKey}' already exists in section ${dto.section} for this business class`,
        );
      }
      throw error;
    }
  }

  async updateField(
    user: RequestUser,
    businessClassId: string,
    fieldId: string,
    dto: UpdateBusinessClassFieldDto,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    await this.assertFieldExists(user.tenantId, businessClassId, fieldId);

    if (
      dto.fieldType === BusinessClassFieldType.SELECT ||
      dto.options !== undefined
    ) {
      const current = await this.prisma.businessClassField.findFirst({
        where: { id: fieldId, tenantId: user.tenantId, businessClassId },
        select: { fieldType: true, options: true },
      });
      if (current) {
        const effectiveType = dto.fieldType ?? current.fieldType;
        const effectiveOptions =
          dto.options ?? (current.options as string[] | null);
        this.assertSelectHasOptions(
          effectiveType,
          effectiveOptions ?? undefined,
        );
      }
    }

    return this.prisma.businessClassField.update({
      where: { id: fieldId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.fieldType !== undefined ? { fieldType: dto.fieldType } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.options !== undefined
          ? {
              options: dto.options
                ? (dto.options as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(dto.validationRules !== undefined
          ? {
              validationRules: dto.validationRules
                ? (dto.validationRules as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(dto.placeholder !== undefined
          ? { placeholder: dto.placeholder?.trim() || null }
          : {}),
        ...(dto.helpText !== undefined
          ? { helpText: dto.helpText?.trim() || null }
          : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteField(
    user: RequestUser,
    businessClassId: string,
    fieldId: string,
  ): Promise<void> {
    await this.assertFieldExists(user.tenantId, businessClassId, fieldId);
    await this.prisma.businessClassField.delete({ where: { id: fieldId } });
  }

  async getFormSchema(tenantId: string, id: string) {
    const bc = await this.findOne(tenantId, id);
    const activeFields = bc.fields.filter((f) => f.isActive);

    return {
      id: bc.id,
      name: bc.name,
      code: bc.code,
      description: bc.description,
      businessDetails: activeFields
        .filter((f) => f.section === BusinessClassFieldSection.BUSINESS_DETAILS)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((f) => this.toFormSchemaField(f)),
      offerDetails: activeFields
        .filter((f) => f.section === BusinessClassFieldSection.OFFER_DETAILS)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((f) => this.toFormSchemaField(f)),
    };
  }

  private toFormSchemaField(field: BusinessClassRecord['fields'][number]): {
    fieldKey: string;
    label: string;
    fieldType: BusinessClassFieldType;
    required: boolean;
    options: string[] | null;
    validationRules: Record<string, unknown> | null;
    placeholder: string | null;
    helpText: string | null;
    displayOrder: number;
  } {
    return {
      fieldKey: field.fieldKey,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      options: (field.options as string[] | null) ?? null,
      validationRules:
        (field.validationRules as Record<string, unknown> | null) ?? null,
      placeholder: field.placeholder,
      helpText: field.helpText,
      displayOrder: field.displayOrder,
    };
  }

  private async assertExists(
    tenantId: string,
    id: string,
  ): Promise<BusinessClassRecord> {
    const bc = await this.prisma.businessClass.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: businessClassInclude,
    });
    if (!bc) throw new NotFoundException('Business class not found');
    return bc;
  }

  private async assertFieldExists(
    tenantId: string,
    businessClassId: string,
    fieldId: string,
  ) {
    const field = await this.prisma.businessClassField.findFirst({
      where: { id: fieldId, tenantId, businessClassId },
    });
    if (!field) throw new NotFoundException('Business class field not found');
    return field;
  }

  private assertSelectHasOptions(
    fieldType: BusinessClassFieldType,
    options?: string[],
  ): void {
    if (
      fieldType === BusinessClassFieldType.SELECT &&
      (!options || options.length === 0)
    ) {
      throw new BadRequestException(
        'SELECT fields must define at least one option',
      );
    }
  }

  private rethrowWriteError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A business class with this code already exists for this tenant',
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Business class not found');
    }
  }
}

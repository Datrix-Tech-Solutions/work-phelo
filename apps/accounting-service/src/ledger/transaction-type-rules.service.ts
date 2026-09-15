import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  PostingDirection,
  TransactionTypeCategory,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';
import {
  CreateTaxTypeDto,
  CreateTransactionTypeRuleDto,
  TransactionTypeRuleLineDto,
  UpdateTaxTypeDto,
  UpdateTransactionTypeRuleDto,
} from './dto/transaction-type-rules.dto';

const ruleInclude = {
  lines: {
    orderBy: { sequence: 'asc' as const },
    include: {
      account: { select: { id: true, code: true, name: true } },
      taxType: { select: { id: true, name: true, rate: true } },
    },
  },
} satisfies Prisma.TransactionTypeRuleInclude;

type RuleWithLines = Prisma.TransactionTypeRuleGetPayload<{
  include: typeof ruleInclude;
}>;

@Injectable()
export class TransactionTypeRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: AccountingMasterDataService,
  ) {}

  // ---- Tax Types --------------------------------------------------------

  async listTaxTypes(tenantId: string) {
    const taxTypes = await this.prisma.taxType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return taxTypes.map((taxType) => this.toTaxTypeDto(taxType));
  }

  async createTaxType(user: RequestUser, dto: CreateTaxTypeDto) {
    try {
      const taxType = await this.prisma.taxType.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          rate: dto.rate,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(user, 'TAX_TYPE_CREATE', 'TaxType', taxType.id, {
        code: taxType.code,
        rate: dto.rate,
      });
      return this.toTaxTypeDto(taxType);
    } catch (error) {
      this.rethrowUnique(error, 'Tax type code already exists');
    }
  }

  async updateTaxType(
    user: RequestUser,
    taxTypeId: string,
    dto: UpdateTaxTypeDto,
  ) {
    const taxType = await this.findTaxType(user.tenantId, taxTypeId);
    try {
      const updated = await this.prisma.taxType.update({
        where: { id_tenantId: { id: taxType.id, tenantId: user.tenantId } },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
          ...(dto.effectiveFrom !== undefined
            ? { effectiveFrom: new Date(dto.effectiveFrom) }
            : {}),
          ...(dto.effectiveTo !== undefined
            ? {
                effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
              }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(user, 'TAX_TYPE_UPDATE', 'TaxType', updated.id, {
        code: updated.code,
      });
      return this.toTaxTypeDto(updated);
    } catch (error) {
      this.rethrowUnique(error, 'Tax type code already exists');
    }
  }

  async deleteTaxType(user: RequestUser, taxTypeId: string) {
    const taxType = await this.findTaxType(user.tenantId, taxTypeId);
    try {
      await this.prisma.taxType.delete({
        where: { id_tenantId: { id: taxType.id, tenantId: user.tenantId } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Tax type is used by one or more rules and cannot be deleted',
        );
      }
      throw error;
    }
    await this.recordAudit(user, 'TAX_TYPE_DELETE', 'TaxType', taxType.id, {
      code: taxType.code,
    });
  }

  private async findTaxType(tenantId: string, id: string) {
    const taxType = await this.prisma.taxType.findFirst({
      where: { id, tenantId },
    });
    if (!taxType) throw new NotFoundException('Tax type not found');
    return taxType;
  }

  private toTaxTypeDto(taxType: {
    id: string;
    code: string;
    name: string;
    rate: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
  }) {
    return {
      id: taxType.id,
      code: taxType.code,
      name: taxType.name,
      rate: Number(taxType.rate.toString()),
      effectiveFrom: taxType.effectiveFrom.toISOString(),
      effectiveTo: taxType.effectiveTo
        ? taxType.effectiveTo.toISOString()
        : null,
      isActive: taxType.isActive,
    };
  }

  // ---- Transaction Type Rules --------------------------------------------

  async listRules(tenantId: string) {
    const rules = await this.prisma.transactionTypeRule.findMany({
      where: { tenantId },
      include: ruleInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rules.map((rule) => this.toRuleDto(rule));
  }

  async createRule(user: RequestUser, dto: CreateTransactionTypeRuleDto) {
    const transactionType = await this.findTransactionType(
      user.tenantId,
      dto.transactionTypeId,
    );
    this.validateLines(transactionType.category, dto.lines);
    await this.validateLineReferences(
      user.tenantId,
      transactionType,
      dto.lines,
    );

    try {
      const rule = await this.prisma.transactionTypeRule.create({
        data: {
          tenantId: user.tenantId,
          transactionTypeId: transactionType.id,
          description: this.optional(dto.description),
          createdByUserId: user.id,
          updatedByUserId: user.id,
          lines: { create: this.lineWrites(dto.lines) },
        },
        include: ruleInclude,
      });
      await this.recordAudit(
        user,
        'TRANSACTION_TYPE_RULE_CREATE',
        'TransactionTypeRule',
        rule.id,
        {
          transactionTypeId: rule.transactionTypeId,
          lineCount: rule.lines.length,
        },
      );
      return this.toRuleDto(rule);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This transaction type already has a rule');
      }
      throw error;
    }
  }

  async updateRule(
    user: RequestUser,
    ruleId: string,
    dto: UpdateTransactionTypeRuleDto,
  ) {
    const rule = await this.findRule(user.tenantId, ruleId);
    if (dto.lines) {
      this.validateLines(rule.transactionType.category, dto.lines);
      await this.validateLineReferences(
        user.tenantId,
        rule.transactionType,
        dto.lines,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.transactionTypeRuleLine.deleteMany({
          where: { ruleId: rule.id, tenantId: user.tenantId },
        });
      }
      return tx.transactionTypeRule.update({
        where: { id_tenantId: { id: rule.id, tenantId: user.tenantId } },
        data: {
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          updatedByUserId: user.id,
          ...(dto.lines
            ? { lines: { create: this.lineWrites(dto.lines) } }
            : {}),
        },
        include: ruleInclude,
      });
    });
    await this.recordAudit(
      user,
      'TRANSACTION_TYPE_RULE_UPDATE',
      'TransactionTypeRule',
      updated.id,
      { lineCount: updated.lines.length },
    );
    return this.toRuleDto(updated);
  }

  async deleteRule(user: RequestUser, ruleId: string) {
    const rule = await this.findRule(user.tenantId, ruleId);
    await this.prisma.transactionTypeRule.delete({
      where: { id_tenantId: { id: rule.id, tenantId: user.tenantId } },
    });
    await this.recordAudit(
      user,
      'TRANSACTION_TYPE_RULE_DELETE',
      'TransactionTypeRule',
      rule.id,
      { transactionTypeId: rule.transactionTypeId },
    );
  }

  // Nested under `rule: { lines: { create: [...] } }` — tenantId is part of the
  // composite FK back to the parent rule ([ruleId, tenantId]), so Prisma derives it
  // from the parent automatically and rejects it if passed explicitly here.
  private lineWrites(lines: TransactionTypeRuleLineDto[]) {
    return lines.map((line, index) => ({
      sequence: index + 1,
      direction: line.direction,
      accountId: line.accountId,
      taxTypeId: line.taxTypeId,
      subledgerType: line.subledgerType,
      description: this.optional(line.description),
    }));
  }

  /** Debit for RECEIVABLE, Credit for PAYABLE — the side whose lone line's amount is
   *  derived (sum of the other side) rather than entered. NEUTRAL/NONE types have no
   *  such side; a plain two-line rule (one debit, one credit) is enough for those. */
  private autoBalanceDirection(
    category: TransactionTypeCategory,
  ): PostingDirection | null {
    if (category === TransactionTypeCategory.RECEIVABLE) {
      return PostingDirection.DR;
    }
    if (category === TransactionTypeCategory.PAYABLE) {
      return PostingDirection.CR;
    }
    return null;
  }

  private validateLines(
    category: TransactionTypeCategory,
    lines: TransactionTypeRuleLineDto[],
  ) {
    const debitLines = lines.filter((l) => l.direction === PostingDirection.DR);
    const creditLines = lines.filter(
      (l) => l.direction === PostingDirection.CR,
    );
    if (debitLines.length === 0 || creditLines.length === 0) {
      throw new BadRequestException(
        'A rule needs at least one debit line and one credit line.',
      );
    }

    const autoBalanceDirection = this.autoBalanceDirection(category);
    if (!autoBalanceDirection) return;

    const balancingLines = lines.filter(
      (l) => l.direction === autoBalanceDirection,
    );
    if (balancingLines.length !== 1) {
      throw new BadRequestException(
        `Exactly one ${autoBalanceDirection === PostingDirection.DR ? 'debit' : 'credit'} ` +
          'line is required for this category — its amount is derived automatically ' +
          '(the sum of the other side) rather than entered, so it can absorb tax lines.',
      );
    }
    if (balancingLines[0].taxTypeId) {
      throw new BadRequestException(
        'The auto-balancing line cannot itself be a tax line.',
      );
    }
  }

  private async validateLineReferences(
    tenantId: string,
    transactionType: { businessRoles: string[] },
    lines: TransactionTypeRuleLineDto[],
  ) {
    for (const line of lines) {
      await this.masterData.findGLAccount(tenantId, line.accountId);
      if (line.taxTypeId) {
        await this.findTaxType(tenantId, line.taxTypeId);
      }
      if (
        line.subledgerType &&
        !transactionType.businessRoles.includes(line.subledgerType)
      ) {
        throw new BadRequestException(
          `${line.subledgerType} is not one of this transaction type's Business Roles`,
        );
      }
    }
  }

  private async findTransactionType(tenantId: string, id: string) {
    const transactionType = await this.prisma.transactionType.findFirst({
      where: { id, tenantId },
    });
    if (!transactionType) {
      throw new NotFoundException('Transaction type not found');
    }
    return transactionType;
  }

  private async findRule(tenantId: string, id: string) {
    const rule = await this.prisma.transactionTypeRule.findFirst({
      where: { id, tenantId },
      include: { transactionType: true },
    });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  private toRuleDto(rule: RuleWithLines) {
    return {
      id: rule.id,
      transactionTypeId: rule.transactionTypeId,
      description: rule.description,
      lines: rule.lines.map((line) => ({
        id: line.id,
        sequence: line.sequence,
        direction: line.direction,
        account: line.account,
        taxType: line.taxType
          ? {
              id: line.taxType.id,
              name: line.taxType.name,
              rate: Number(line.taxType.rate.toString()),
            }
          : null,
        subledgerType: line.subledgerType,
        description: line.description,
      })),
    };
  }

  private optional(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value.trim() || null;
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
    changedFields?: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType,
        entityId,
        changedFields: JSON.parse(
          JSON.stringify(changedFields ?? {}),
        ) as Prisma.InputJsonValue,
      },
    });
  }
}

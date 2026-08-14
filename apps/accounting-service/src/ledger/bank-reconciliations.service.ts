import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, RecordStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBankReconciliationDto,
  QueryBankReconciliationsDto,
} from './dto/bank-reconciliations.dto';

const reconciliationInclude = {
  cashAccount: {
    select: {
      id: true,
      name: true,
      accountKind: true,
      currency: true,
      bankName: true,
      accountNumber: true,
    },
  },
  _count: { select: { statementLines: true } },
} satisfies Prisma.BankReconciliationInclude;

@Injectable()
export class BankReconciliationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, query: QueryBankReconciliationsDto) {
    return this.prisma.bankReconciliation.findMany({
      where: {
        tenantId,
        ...(query.cashAccountId ? { cashAccountId: query.cashAccountId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.fromDate || query.toDate
          ? {
              statementEndDate: {
                ...(query.fromDate
                  ? { gte: this.startOfDay(query.fromDate) }
                  : {}),
                ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
              },
            }
          : {}),
      },
      include: reconciliationInclude,
      orderBy: [{ statementEndDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(tenantId: string, reconciliationId: string) {
    const reconciliation = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId },
      include: reconciliationInclude,
    });
    if (!reconciliation)
      throw new NotFoundException('Bank reconciliation not found');
    return reconciliation;
  }

  async create(user: RequestUser, dto: CreateBankReconciliationDto) {
    const startDate = this.startOfDay(dto.statementStartDate);
    const endDate = this.endOfDay(dto.statementEndDate);
    if (startDate > endDate) {
      throw new BadRequestException(
        'Statement start date must not be after statement end date',
      );
    }

    const cashAccount = await this.prisma.accountingCashAccount.findFirst({
      where: { id: dto.cashAccountId, tenantId: user.tenantId, isActive: true },
      select: {
        id: true,
        currency: true,
        glAccount: { select: { status: true } },
      },
    });
    if (!cashAccount || cashAccount.glAccount.status !== RecordStatus.ACTIVE) {
      throw new NotFoundException('Active tenant cash account not found');
    }
    if (cashAccount.currency !== dto.currency) {
      throw new BadRequestException(
        'Reconciliation currency must match the selected cash account',
      );
    }

    try {
      const reconciliation = await this.prisma.bankReconciliation.create({
        data: {
          tenantId: user.tenantId,
          cashAccountId: cashAccount.id,
          statementReference: dto.statementReference,
          statementStartDate: startDate,
          statementEndDate: endDate,
          openingBalance: dto.openingBalance,
          closingBalance: dto.closingBalance,
          currency: dto.currency,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: reconciliationInclude,
      });
      await this.recordAudit(
        user,
        'BANK_RECONCILIATION_CREATE',
        reconciliation.id,
        {
          cashAccountId: reconciliation.cashAccountId,
          statementReference: reconciliation.statementReference,
          statementStartDate: reconciliation.statementStartDate.toISOString(),
          statementEndDate: reconciliation.statementEndDate.toISOString(),
          currency: reconciliation.currency,
        },
      );
      return reconciliation;
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'A bank reconciliation already exists for this cash account and statement reference',
        );
      }
      throw error;
    }
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityId: string,
    changedFields: Record<string, unknown>,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType: 'BankReconciliation',
        entityId,
        changedFields: changedFields as Prisma.InputJsonValue,
      },
    });
  }

  private startOfDay(value: string) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

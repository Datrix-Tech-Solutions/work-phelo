import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingPaymentRequestStatus,
  AccountingReceivableAllocationSource,
  AccountingReceivableDocumentType,
  AccountingReceivableStatus,
  Prisma,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReceivablesService } from '../receivables.service';
import { registrationFor } from '../source-transactions/source-registry';
import {
  CancelPaymentRequestDto,
  CompletePaymentRequestDto,
  CreatePaymentRequestDto,
  QueryPaymentRequestsDto,
} from './dto/payment-request.dto';

type Request = Prisma.AccountingPaymentRequestGetPayload<object>;

const zero = new Prisma.Decimal(0);

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receivables: ReceivablesService,
  ) {}

  /**
   * Another module asks Accounting to record a payment against one of its record's posted invoices.
   * Nothing moves yet - it waits for an accountant. Only what is still unclaimed can be requested.
   */
  async createFromSource(actingUserId: string, dto: CreatePaymentRequestDto) {
    const registration = registrationFor(dto.sourceModule);
    if (!registration) {
      throw new BadRequestException(
        `${dto.sourceModule} cannot raise payment requests`,
      );
    }

    const existing = await this.findByKey(dto);
    if (existing) return this.toResult(existing);

    const invoice = await this.invoiceOfRecord(
      dto.tenantId,
      dto.invoiceId,
      `${registration.module}:${dto.externalRef}`,
    );
    if (invoice.status !== AccountingReceivableStatus.POSTED) {
      throw new ConflictException(
        'A payment can only be requested for a posted invoice',
      );
    }
    const paymentDate = this.dateOnly(dto.paymentDate);
    if (paymentDate.getTime() > Date.now()) {
      throw new BadRequestException('The payment date cannot be in the future');
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Two people claiming at once must not both fit into the same balance.
        await tx.$queryRaw`
          SELECT "id" FROM "accounting"."AccountingReceivableDocument"
          WHERE "id" = ${invoice.id} AND "tenantId" = ${dto.tenantId} FOR UPDATE
        `;
        const claimable = await this.claimable(tx, dto.tenantId, invoice.id);
        const amount = new Prisma.Decimal(dto.amount);
        if (claimable.lte(zero)) {
          throw new ConflictException(
            'There is nothing left to claim on this invoice',
          );
        }
        if (amount.gt(claimable)) {
          throw new BadRequestException(
            `The amount is more than can still be claimed (${claimable.toFixed(2)})`,
          );
        }
        return tx.accountingPaymentRequest.create({
          data: {
            tenantId: dto.tenantId,
            sourceModule: dto.sourceModule,
            idempotencyKey: dto.idempotencyKey,
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            amount,
            currency: invoice.currency,
            paymentDate,
            reference: dto.reference ?? null,
            note: dto.note ?? null,
            requestedByUserId: actingUserId,
            requestedByName: dto.requestedByName ?? null,
          },
        });
      });
      return this.toResult(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.findByKey(dto);
        if (raced) return this.toResult(raced);
      }
      throw error;
    }
  }

  /** The module withdraws a request that has not been acted on. Its amount is released. */
  async cancelFromSource(
    actingUserId: string,
    requestId: string,
    dto: CancelPaymentRequestDto,
  ) {
    const registration = registrationFor(dto.sourceModule);
    if (!registration) {
      throw new BadRequestException(
        `${dto.sourceModule} cannot cancel payment requests`,
      );
    }
    const request = await this.prisma.accountingPaymentRequest.findFirst({
      where: {
        id: requestId,
        tenantId: dto.tenantId,
        sourceModule: dto.sourceModule,
      },
    });
    // Only a request for this module's own record - never another's.
    if (
      !request ||
      !(await this.belongsToRecord(
        request,
        `${registration.module}:${dto.externalRef}`,
      ))
    ) {
      throw new NotFoundException('Payment request not found');
    }
    if (
      request.status !== AccountingPaymentRequestStatus.PENDING ||
      request.receiptId
    ) {
      throw new ConflictException(
        request.status === AccountingPaymentRequestStatus.PENDING
          ? 'This payment is already being recorded and can no longer be cancelled'
          : 'Only a pending payment request can be cancelled',
      );
    }
    const claimed = await this.prisma.accountingPaymentRequest.updateMany({
      where: {
        id: request.id,
        tenantId: dto.tenantId,
        status: AccountingPaymentRequestStatus.PENDING,
        receiptId: null,
      },
      data: {
        status: AccountingPaymentRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: actingUserId,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'The payment request was changed by someone else',
      );
    }
    return { id: request.id, status: AccountingPaymentRequestStatus.CANCELLED };
  }

  /** Requests for the Transactions page: by default only those still waiting for an accountant. */
  async list(tenantId: string, query: QueryPaymentRequestsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.AccountingPaymentRequestWhereInput = {
      tenantId,
      status: query.status ?? AccountingPaymentRequestStatus.PENDING,
    };
    const [total, requests] = await this.prisma.$transaction([
      this.prisma.accountingPaymentRequest.count({ where }),
      this.prisma.accountingPaymentRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: await this.toItems(tenantId, requests),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /** Every request for one invoice, whatever became of it - the invoice's request history. */
  async listForInvoice(tenantId: string, invoiceId: string) {
    const requests = await this.prisma.accountingPaymentRequest.findMany({
      where: { tenantId, invoiceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return { items: await this.toItems(tenantId, requests) };
  }

  /** How many requests each of these invoices has waiting - for the Receivables list tag. */
  async pendingCounts(tenantId: string, invoiceIds: string[]) {
    if (invoiceIds.length === 0) return new Map<string, number>();
    const rows = await this.prisma.accountingPaymentRequest.groupBy({
      by: ['invoiceId'],
      where: {
        tenantId,
        invoiceId: { in: invoiceIds },
        status: AccountingPaymentRequestStatus.PENDING,
      },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.invoiceId, row._count._all]));
  }

  async reject(user: RequestUser, requestId: string, reason: string) {
    const request = await this.findForTenant(user.tenantId, requestId);
    if (request.status !== AccountingPaymentRequestStatus.PENDING) {
      throw new ConflictException(
        'Only a pending payment request can be rejected',
      );
    }
    if (request.receiptId) {
      throw new ConflictException(
        'A receipt has already been created for this request - finish recording it instead',
      );
    }
    const claimed = await this.prisma.accountingPaymentRequest.updateMany({
      where: {
        id: request.id,
        tenantId: user.tenantId,
        status: AccountingPaymentRequestStatus.PENDING,
        receiptId: null,
      },
      data: {
        status: AccountingPaymentRequestStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedByUserId: user.id,
        rejectionReason: reason,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'The payment request was changed by someone else',
      );
    }
    await this.audit(user, 'PAYMENT_REQUEST_REJECTED', request.id, { reason });
    const rejected = await this.findForTenant(user.tenantId, requestId);
    return (await this.toItems(user.tenantId, [rejected]))[0];
  }

  /**
   * The accountant confirms the payment: the receipt is created for the chosen bank, posted, and
   * allocated to the invoice. If a step fails, the request stays pending with the receipt it has
   * got so far, and completing again carries on from there instead of recording the money twice.
   */
  async complete(
    user: RequestUser,
    requestId: string,
    dto: CompletePaymentRequestDto,
  ) {
    let request = await this.findForTenant(user.tenantId, requestId);
    if (request.status !== AccountingPaymentRequestStatus.PENDING) {
      throw new ConflictException(
        'Only a pending payment request can be completed',
      );
    }

    const invoice = await this.prisma.accountingReceivableDocument.findFirst({
      where: {
        id: request.invoiceId,
        tenantId: user.tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
      },
    });
    if (!invoice || invoice.status !== AccountingReceivableStatus.POSTED) {
      throw new ConflictException(
        'The invoice is no longer open for payment — reject this request',
      );
    }

    if (!request.receiptId) {
      const outstanding = (
        await this.receivables.invoiceBalance(user.tenantId, invoice.id)
      ).outstandingAmount;
      if (request.amount.gt(new Prisma.Decimal(outstanding))) {
        throw new ConflictException(
          `The invoice now owes ${outstanding}, less than this request — reject it and ask for a new one`,
        );
      }
      const claimed = await this.prisma.accountingPaymentRequest.updateMany({
        where: {
          id: request.id,
          tenantId: user.tenantId,
          status: AccountingPaymentRequestStatus.PENDING,
          processingStartedAt: null,
          receiptId: null,
        },
        data: { processingStartedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('This payment is already being recorded');
      }
      try {
        const receipt = await this.receivables.createReceipt(user, {
          customerId: request.customerId,
          invoiceId: request.invoiceId,
          cashAccountId: dto.cashAccountId,
          amount: Number(request.amount),
          currency: request.currency,
          receiptDate: dto.receiptDate,
          settlementMethod: dto.settlementMethod,
          reference: request.reference ?? undefined,
          description: request.note ?? undefined,
          sourceModule: request.sourceModule,
          sourceRecordId: request.id,
        });
        request = await this.prisma.accountingPaymentRequest.update({
          where: { id: request.id },
          data: { receiptId: receipt.id },
        });
      } catch (error) {
        // Nothing was created, so let the next attempt start clean.
        await this.prisma.accountingPaymentRequest.update({
          where: { id: request.id },
          data: { processingStartedAt: null },
        });
        throw error;
      }
    }

    const receiptId = request.receiptId as string;
    const receipt = await this.prisma.accountingReceivableReceipt.findFirst({
      where: { id: receiptId, tenantId: user.tenantId },
      select: { status: true, receiptNumber: true },
    });
    if (!receipt)
      throw new NotFoundException('The receipt for this request was not found');
    if (receipt.status === AccountingReceivableStatus.DRAFT) {
      await this.receivables.postReceipt(user, receiptId);
    }
    const allocated =
      await this.prisma.accountingReceivableAllocation.findFirst({
        where: {
          tenantId: user.tenantId,
          receiptId,
          invoiceId: request.invoiceId,
          sourceType: AccountingReceivableAllocationSource.RECEIPT,
          reversedAt: null,
        },
        select: { id: true },
      });
    if (!allocated) {
      await this.receivables.allocateReceipt(user, receiptId, {
        invoiceId: request.invoiceId,
        amount: Number(request.amount),
      });
    }

    await this.prisma.accountingPaymentRequest.update({
      where: { id: request.id },
      data: {
        status: AccountingPaymentRequestStatus.COMPLETED,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
    });
    await this.audit(user, 'PAYMENT_REQUEST_COMPLETED', request.id, {
      receiptId,
      receiptNumber: receipt.receiptNumber,
    });
    const done = await this.findForTenant(user.tenantId, requestId);
    return (await this.toItems(user.tenantId, [done]))[0];
  }

  /** What can still be claimed on an invoice: what it owes, less requests already waiting. */
  private async claimable(
    tx: Prisma.TransactionClient,
    tenantId: string,
    invoiceId: string,
  ): Promise<Prisma.Decimal> {
    const balance = await this.receivables.invoiceBalance(tenantId, invoiceId);
    const pending = await tx.accountingPaymentRequest.aggregate({
      where: {
        tenantId,
        invoiceId,
        status: AccountingPaymentRequestStatus.PENDING,
      },
      _sum: { amount: true },
    });
    return new Prisma.Decimal(balance.outstandingAmount).minus(
      pending._sum.amount ?? zero,
    );
  }

  private async invoiceOfRecord(
    tenantId: string,
    invoiceId: string,
    entityRef: string,
  ) {
    const invoice = await this.prisma.accountingReceivableDocument.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
      },
    });
    const entity = invoice
      ? await this.prisma.subledgerAccount.findFirst({
          where: { id: invoice.customerId, tenantId },
          select: { externalRef: true },
        })
      : null;
    // Only the module's own record's invoices - never another's.
    if (!invoice || entity?.externalRef !== entityRef) {
      throw new NotFoundException('Invoice not found for this record');
    }
    return invoice;
  }

  private async belongsToRecord(request: Request, entityRef: string) {
    const entity = await this.prisma.subledgerAccount.findFirst({
      where: { id: request.customerId, tenantId: request.tenantId },
      select: { externalRef: true },
    });
    return entity?.externalRef === entityRef;
  }

  private findByKey(dto: CreatePaymentRequestDto) {
    return this.prisma.accountingPaymentRequest.findUnique({
      where: {
        tenantId_sourceModule_idempotencyKey: {
          tenantId: dto.tenantId,
          sourceModule: dto.sourceModule,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });
  }

  private async findForTenant(tenantId: string, id: string) {
    const request = await this.prisma.accountingPaymentRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw new NotFoundException('Payment request not found');
    return request;
  }

  private toResult(request: Request) {
    return {
      id: request.id,
      status: request.status,
      amount: request.amount.toFixed(2),
    };
  }

  private async toItems(tenantId: string, requests: Request[]) {
    const invoices = await this.prisma.accountingReceivableDocument.findMany({
      where: {
        tenantId,
        id: { in: [...new Set(requests.map((r) => r.invoiceId))] },
      },
      select: { id: true, documentNumber: true },
    });
    const customers = await this.prisma.subledgerAccount.findMany({
      where: {
        tenantId,
        id: { in: [...new Set(requests.map((r) => r.customerId))] },
      },
      select: { id: true, name: true, code: true },
    });
    const receipts = await this.prisma.accountingReceivableReceipt.findMany({
      where: {
        tenantId,
        id: {
          in: requests
            .map((r) => r.receiptId)
            .filter((id): id is string => Boolean(id)),
        },
      },
      select: { id: true, receiptNumber: true },
    });
    const invoiceNumber = new Map(
      invoices.map((i) => [i.id, i.documentNumber]),
    );
    const customer = new Map(customers.map((c) => [c.id, c]));
    const receiptNumber = new Map(receipts.map((r) => [r.id, r.receiptNumber]));

    return requests.map((r) => ({
      id: r.id,
      status: r.status,
      sourceModule: r.sourceModule,
      invoiceId: r.invoiceId,
      invoiceNumber: invoiceNumber.get(r.invoiceId) ?? null,
      entity: customer.get(r.customerId)
        ? {
            id: r.customerId,
            name: customer.get(r.customerId)!.name,
            code: customer.get(r.customerId)!.code,
          }
        : { id: r.customerId, name: '', code: '' },
      amount: r.amount.toFixed(2),
      currency: r.currency,
      paymentDate: r.paymentDate.toISOString().slice(0, 10),
      reference: r.reference,
      note: r.note,
      requestedByUserId: r.requestedByUserId,
      requestedByName: r.requestedByName,
      receiptId: r.receiptId,
      receiptNumber: r.receiptId
        ? (receiptNumber.get(r.receiptId) ?? null)
        : null,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      rejectedAt: r.rejectedAt?.toISOString() ?? null,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
    }));
  }

  private dateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private async audit(
    user: RequestUser,
    action: string,
    entityId: string,
    changed: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType: 'AccountingPaymentRequest',
        entityId,
        changedFields: JSON.parse(
          JSON.stringify(changed ?? {}),
        ) as Prisma.InputJsonValue,
      },
    });
  }
}

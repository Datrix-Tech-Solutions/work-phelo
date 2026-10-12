import { Injectable } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CashbookService } from './cashbook.service';
import { PayablesService } from './payables.service';
import { ReceivablesService } from './receivables.service';
import { QueryTransactionsDto } from './dto/transactions.dto';

type Kind =
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'CASHBOOK'
  | 'RECEIVABLE_RECEIPT'
  | 'PAYABLE_PAYMENT';
interface Row {
  kind: Kind;
  id: string;
}

/**
 * The Transactions page in one request: invoices, bills, credit/debit notes, the receipts and
 * payments made against them, and direct cashbook entries, newest first. The filtering, search and paging all happen in the database, so a page
 * costs the same however much history there is. Only the ids are merged in SQL; the rows
 * themselves are then loaded the same way the individual lists load them.
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receivables: ReceivablesService,
    private readonly payables: PayablesService,
    private readonly cashbook: CashbookService,
  ) {}

  async list(tenantId: string, query: QueryTransactionsDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 10), 100);

    const branches: Prisma.Sql[] = [];
    if (!query.type || query.type === 'RECEIVABLE') {
      branches.push(
        this.documentBranch(
          'RECEIVABLE',
          'AccountingReceivableDocument',
          'customerId',
          tenantId,
          query,
        ),
      );
    }
    if (!query.type || query.type === 'PAYABLE') {
      branches.push(
        this.documentBranch(
          'PAYABLE',
          'AccountingPayableDocument',
          'vendorId',
          tenantId,
          query,
        ),
      );
    }
    // A receipt or payment made against an invoice or bill is listed with that side, linked to
    // the documents it settles.
    if (!query.type || query.type === 'RECEIVABLE') {
      branches.push(
        this.settlementBranch(
          'RECEIVABLE_RECEIPT',
          'AccountingReceivableReceipt',
          'customerId',
          tenantId,
          query,
        ),
      );
    }
    if (!query.type || query.type === 'PAYABLE') {
      branches.push(
        this.settlementBranch(
          'PAYABLE_PAYMENT',
          'AccountingPayablePayment',
          'vendorId',
          tenantId,
          query,
        ),
      );
    }
    if (!query.type || query.type === 'CASHBOOK' || query.type === 'TRANSFER') {
      branches.push(this.cashbookBranch(tenantId, query));
    }
    const union = Prisma.join(branches, ' UNION ALL ');

    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT "kind", "id" FROM (${union}) AS t
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM (${union}) AS t
      `),
    ]);
    const total = Number(counted[0]?.count ?? 0);

    const idsOf = (kind: Kind) =>
      rows.filter((row) => row.kind === kind).map((row) => row.id);
    const [receivable, payable, cashbook, receipts, payments] =
      await Promise.all([
        this.receivables.listDocumentsByIds(tenantId, idsOf('RECEIVABLE')),
        this.payables.listDocumentsByIds(tenantId, idsOf('PAYABLE')),
        this.cashbook.listTransactionsByIds(tenantId, idsOf('CASHBOOK')),
        this.receivables.listReceiptsByIds(
          tenantId,
          idsOf('RECEIVABLE_RECEIPT'),
        ),
        this.payables.listPaymentsByIds(tenantId, idsOf('PAYABLE_PAYMENT')),
      ]);
    const [receiptLinks, paymentLinks] = await Promise.all([
      this.linkedInvoices(tenantId, idsOf('RECEIVABLE_RECEIPT')),
      this.linkedBills(tenantId, idsOf('PAYABLE_PAYMENT')),
    ]);
    const records: Record<Kind, Map<string, unknown>> = {
      RECEIVABLE: new Map(receivable.map((item) => [item.id, item])),
      PAYABLE: new Map(payable.map((item) => [item.id, item])),
      CASHBOOK: new Map(cashbook.map((item) => [item.id, item])),
      RECEIVABLE_RECEIPT: new Map(
        receipts.map((item) => [
          item.id,
          { ...item, linkedDocuments: receiptLinks.get(item.id) ?? [] },
        ]),
      ),
      PAYABLE_PAYMENT: new Map(
        payments.map((item) => [
          item.id,
          { ...item, linkedDocuments: paymentLinks.get(item.id) ?? [] },
        ]),
      ),
    };
    const items = rows.flatMap((row) => {
      const record = records[row.kind].get(row.id);
      return record ? [{ kind: row.kind, record }] : [];
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** The invoices each receipt is applied to, for the link shown beside it. */
  private async linkedInvoices(tenantId: string, receiptIds: string[]) {
    const links = new Map<string, { id: string; documentNumber: string }[]>();
    if (receiptIds.length === 0) return links;
    const allocations =
      await this.prisma.accountingReceivableAllocation.findMany({
        where: { tenantId, receiptId: { in: receiptIds }, reversedAt: null },
        select: {
          receiptId: true,
          invoice: { select: { id: true, documentNumber: true } },
        },
        orderBy: { allocatedAt: 'asc' },
      });
    for (const allocation of allocations) {
      if (!allocation.receiptId) continue;
      const list = links.get(allocation.receiptId) ?? [];
      if (!list.some((document) => document.id === allocation.invoice.id)) {
        list.push(allocation.invoice);
      }
      links.set(allocation.receiptId, list);
    }
    return links;
  }

  /** The bills each payment is applied to, for the link shown beside it. */
  private async linkedBills(tenantId: string, paymentIds: string[]) {
    const links = new Map<string, { id: string; documentNumber: string }[]>();
    if (paymentIds.length === 0) return links;
    const allocations = await this.prisma.accountingPayableAllocation.findMany({
      where: { tenantId, paymentId: { in: paymentIds }, reversedAt: null },
      select: {
        paymentId: true,
        bill: { select: { id: true, documentNumber: true } },
      },
      orderBy: { allocatedAt: 'asc' },
    });
    for (const allocation of allocations) {
      if (!allocation.paymentId) continue;
      const list = links.get(allocation.paymentId) ?? [];
      if (!list.some((document) => document.id === allocation.bill.id)) {
        list.push(allocation.bill);
      }
      links.set(allocation.paymentId, list);
    }
    return links;
  }

  private like(search: string) {
    return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  }

  private documentBranch(
    kind: 'RECEIVABLE' | 'PAYABLE',
    table: string,
    partyColumn: string,
    tenantId: string,
    query: QueryTransactionsDto,
  ) {
    const column = Prisma.raw(`"${partyColumn}"`);
    const pattern = query.search ? this.like(query.search) : null;
    return Prisma.sql`
      SELECT ${kind}::text AS "kind", d."id" AS "id", d."createdAt" AS "createdAt"
      FROM "accounting".${Prisma.raw(`"${table}"`)} d
      LEFT JOIN "accounting"."SubledgerAccount" s
        ON s."id" = d.${column} AND s."tenantId" = d."tenantId"
      WHERE d."tenantId" = ${tenantId}
        AND ${
          query.status
            ? Prisma.sql`d."status"::text = ${query.status}`
            : Prisma.sql`d."status"::text <> 'VOIDED'`
        }
        ${query.partyId ? Prisma.sql`AND d.${column} = ${query.partyId}` : Prisma.empty}
        ${
          pattern
            ? Prisma.sql`AND (d."documentNumber" ILIKE ${pattern}
                OR s."name" ILIKE ${pattern}
                OR d."status"::text ILIKE ${pattern})`
            : Prisma.empty
        }
    `;
  }

  private settlementBranch(
    kind: 'RECEIVABLE_RECEIPT' | 'PAYABLE_PAYMENT',
    table: string,
    partyColumn: string,
    tenantId: string,
    query: QueryTransactionsDto,
  ) {
    const column = Prisma.raw(`"${partyColumn}"`);
    const numberColumn = Prisma.raw(
      kind === 'RECEIVABLE_RECEIPT' ? '"receiptNumber"' : '"paymentNumber"',
    );
    const pattern = query.search ? this.like(query.search) : null;
    return Prisma.sql`
      SELECT ${kind}::text AS "kind", d."id" AS "id", d."createdAt" AS "createdAt"
      FROM "accounting".${Prisma.raw(`"${table}"`)} d
      LEFT JOIN "accounting"."SubledgerAccount" s
        ON s."id" = d.${column} AND s."tenantId" = d."tenantId"
      WHERE d."tenantId" = ${tenantId}
        AND d."archiveDeletedAt" IS NULL
        AND ${
          query.status
            ? Prisma.sql`d."status"::text = ${query.status}`
            : Prisma.sql`d."status"::text <> 'VOIDED'`
        }
        ${query.partyId ? Prisma.sql`AND d.${column} = ${query.partyId}` : Prisma.empty}
        ${
          pattern
            ? Prisma.sql`AND (d.${numberColumn} ILIKE ${pattern}
                OR d."reference" ILIKE ${pattern}
                OR s."name" ILIKE ${pattern}
                OR d."status"::text ILIKE ${pattern})`
            : Prisma.empty
        }
    `;
  }

  private cashbookBranch(tenantId: string, query: QueryTransactionsDto) {
    const pattern = query.search ? this.like(query.search) : null;
    return Prisma.sql`
      SELECT 'CASHBOOK'::text AS "kind", c."id" AS "id", c."createdAt" AS "createdAt"
      FROM "accounting"."CashbookTransaction" c
      WHERE c."tenantId" = ${tenantId}
        AND c."sourceModule" IS DISTINCT FROM 'ACCOUNTING'
        AND NOT EXISTS (
          SELECT 1 FROM "accounting"."AccountingReceivableReceipt" r
          WHERE r."cashbookTransactionId" = c."id" AND r."tenantId" = c."tenantId"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "accounting"."AccountingPayablePayment" p
          WHERE p."cashbookTransactionId" = c."id" AND p."tenantId" = c."tenantId"
        )
        AND ${
          query.status
            ? Prisma.sql`c."status"::text = ${query.status}`
            : Prisma.sql`c."status"::text <> 'VOIDED'`
        }
        ${
          query.type === 'TRANSFER'
            ? Prisma.sql`AND c."transactionType"::text = 'TRANSFER'`
            : query.type === 'CASHBOOK'
              ? Prisma.sql`AND c."transactionType"::text <> 'TRANSFER'`
              : Prisma.empty
        }
        ${query.partyId ? Prisma.sql`AND c."counterpartyId" = ${query.partyId}` : Prisma.empty}
        ${
          pattern
            ? Prisma.sql`AND (c."transactionNumber" ILIKE ${pattern}
                OR c."reference" ILIKE ${pattern}
                OR c."description" ILIKE ${pattern}
                OR c."status"::text ILIKE ${pattern})`
            : Prisma.empty
        }
    `;
  }
}

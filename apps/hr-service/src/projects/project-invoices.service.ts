import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  Prisma,
  ProjectClientSource,
  ProjectInvoice,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { HR_PERMISSION_DENY_MESSAGE } from '../auth/access-scope';
import { ProjectAccountingClient } from './billing/project-accounting.client';
import { ProjectAccountingEventDto } from './dto/project-accounting-event.dto';
import {
  RaiseProjectInvoiceDto,
  RecordProjectInvoiceDto,
} from './dto/project-invoice.dto';
import { ProjectsService } from './projects.service';

const serialize = (i: ProjectInvoice) => ({
  id: i.id,
  projectId: i.projectId,
  clientId: i.clientId,
  transactionId: i.transactionId,
  description: i.description,
  amount: Number(i.amount),
  lines: i.lines,
  /** What Accounting last reported; null when it is read back elsewhere (a marketing client's invoice). */
  state: i.state,
  createdAt: i.createdAt.toISOString(),
});

const NOT_A_PROJECT_CLIENT =
  "This project's client belongs to marketing, so its invoices are raised through marketing.";

const cents = (n: number) => Math.round(n * 100);

/** The invoices raised from a project. The invoice is the Accounting transaction; this keeps what it was for. */
@Injectable()
export class ProjectInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly accounting: ProjectAccountingClient,
  ) {}

  async list(tenantId: string, projectId: string, user: RequestUser) {
    await this.projects.assertCanView(tenantId, projectId, user);
    const invoices = await this.prisma.projectInvoice.findMany({
      where: { tenantId, projectId },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map(serialize);
  }

  async record(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: RecordProjectInvoiceDto,
  ) {
    const access = await this.projects.getWorkAccess(tenantId, projectId, user);
    if (!access.canManage) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { clientId: true, billable: true },
    });
    if (!project?.billable || !project.clientId) {
      throw new BadRequestException('This project is not billed to a client');
    }

    const existing = await this.prisma.projectInvoice.findFirst({
      where: { id: dto.id, tenantId, projectId },
    });
    if (existing) return serialize(existing);

    try {
      const created = await this.prisma.projectInvoice.create({
        data: {
          id: dto.id,
          tenantId,
          projectId,
          clientId: project.clientId,
          transactionId: dto.transactionId,
          description: dto.description,
          amount: dto.amount,
          lines: dto.lines as unknown as Prisma.InputJsonValue,
          createdByUserId: user.id,
        },
      });
      return serialize(created);
    } catch (e) {
      // The same submission recorded at the same moment from two requests.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const again = await this.prisma.projectInvoice.findFirst({
          where: { id: dto.id, tenantId, projectId },
        });
        if (again) return serialize(again);
      }
      throw e;
    }
  }

  /** The billable project's client, when it is a project client the caller may raise an invoice for. */
  private async projectClientFor(
    tenantId: string,
    projectId: string,
    user: RequestUser,
  ) {
    const access = await this.projects.getWorkAccess(tenantId, projectId, user);
    if (!access.canManage) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { clientId: true, billable: true, clientSource: true },
    });
    if (!project?.billable || !project.clientId) {
      throw new BadRequestException('This project is not billed to a client');
    }
    if (project.clientSource !== ProjectClientSource.PROJECT) {
      throw new BadRequestException(NOT_A_PROJECT_CLIENT);
    }
    const client = await this.prisma.projectClient.findFirst({
      where: { id: project.clientId, tenantId },
    });
    if (!client) throw new BadRequestException('This project client is gone');
    return client;
  }

  /** What the invoice form offers, and whether Accounting is set up to take project invoices. */
  async billingOptions(tenantId: string, projectId: string, user: RequestUser) {
    const client = await this.projectClientFor(tenantId, projectId, user);
    if (!this.accounting.isConfigured()) {
      return {
        ready: false,
        reason: 'NOT_CONFIGURED',
        message: 'Accounting is not connected',
        entityTypes: [],
        transactionTypes: [],
        entityTypeId: client.accountingEntityTypeId,
      };
    }
    const options = await this.accounting.getOptions(tenantId, user.id);
    return { ...options, entityTypeId: client.accountingEntityTypeId };
  }

  /** Raises the invoice in Accounting as a draft, then keeps what it was for on the project. */
  async raise(
    tenantId: string,
    projectId: string,
    user: RequestUser,
    dto: RaiseProjectInvoiceDto,
  ) {
    const client = await this.projectClientFor(tenantId, projectId, user);

    const existing = await this.prisma.projectInvoice.findFirst({
      where: { id: dto.submissionId, tenantId, projectId },
    });
    if (existing) return serialize(existing);

    const total = dto.lines.reduce((sum, l) => sum + cents(l.amount), 0);
    if (dto.lines.length === 0 || total !== cents(dto.amount)) {
      throw new BadRequestException(
        'The invoice amount must equal the total of its lines',
      );
    }
    if (!client.accountingEntityId && !dto.entityTypeId) {
      throw new BadRequestException(
        "Choose an entity type for the client's first invoice",
      );
    }

    // Accounting treats the key as a retry of the same invoice, so a second send changes nothing.
    const created = await this.accounting.createTransaction(
      {
        tenantId,
        idempotencyKey: `project-invoice:${client.id}:${dto.submissionId}`,
        externalRef: client.id,
        entityName: client.name,
        ...(client.accountingEntityId
          ? { entityId: client.accountingEntityId }
          : { entityTypeId: dto.entityTypeId }),
        transactionTypeId: dto.transactionTypeId,
        amount: dto.amount,
        description: dto.description,
      },
      user.id,
    );

    if (!client.accountingEntityId) {
      await this.prisma.projectClient.updateMany({
        where: { id: client.id, tenantId, accountingEntityId: null },
        data: {
          accountingEntityId: created.entityId,
          accountingEntityTypeId: created.entityTypeId,
        },
      });
    }

    try {
      const row = await this.prisma.projectInvoice.create({
        data: {
          id: dto.submissionId,
          tenantId,
          projectId,
          clientId: client.id,
          transactionId: created.transactionId,
          description: dto.description,
          amount: dto.amount,
          lines: dto.lines as unknown as Prisma.InputJsonValue,
          state: created.state,
          createdByUserId: user.id,
        },
      });
      return serialize(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const again = await this.prisma.projectInvoice.findFirst({
          where: { id: dto.submissionId, tenantId, projectId },
        });
        if (again) return serialize(again);
      }
      throw e;
    }
  }

  /** Accounting says what happened to an invoice. Safe to hear twice; answers handled: false for one we did not raise. */
  async handleAccountingEvent(dto: ProjectAccountingEventDto) {
    if (dto.sourceModule !== 'PROJECTS') return { handled: false };
    const result = await this.prisma.projectInvoice.updateMany({
      where: { tenantId: dto.tenantId, transactionId: dto.transactionId },
      data: { state: dto.event },
    });
    return { handled: result.count > 0 };
  }
}

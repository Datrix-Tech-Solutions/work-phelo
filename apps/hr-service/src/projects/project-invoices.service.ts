import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, ProjectInvoice } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { HR_PERMISSION_DENY_MESSAGE } from '../auth/access-scope';
import { RecordProjectInvoiceDto } from './dto/project-invoice.dto';
import { ProjectsService } from './projects.service';

const serialize = (i: ProjectInvoice) => ({
  id: i.id,
  projectId: i.projectId,
  clientId: i.clientId,
  transactionId: i.transactionId,
  description: i.description,
  amount: Number(i.amount),
  lines: i.lines,
  createdAt: i.createdAt.toISOString(),
});

/** The invoices raised from a project. The invoice is the Accounting transaction; this keeps what it was for. */
@Injectable()
export class ProjectInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
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
}

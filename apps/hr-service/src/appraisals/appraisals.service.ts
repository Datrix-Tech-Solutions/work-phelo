import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppraisalCycleDto } from './dto/create-cycle.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import {
  assertHrAccess,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';

@Injectable()
export class AppraisalsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCycle(
    tenantId: string,
    createdBy: string,
    dto: CreateAppraisalCycleDto,
  ) {
    return this.prisma.appraisalCycle.create({
      data: {
        tenantId,
        createdBy,
        title: dto.title,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async getCycles(tenantId: string) {
    return this.prisma.appraisalCycle.findMany({
      where: { tenantId },
      include: { _count: { select: { appraisals: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async startCycle(tenantId: string, cycleId: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({
      where: { id: cycleId, tenantId },
    });
    if (!cycle) throw new NotFoundException('Appraisal cycle not found');

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, employmentStatus: 'ACTIVE' },
    });

    for (const emp of employees) {
      await this.prisma.appraisal.upsert({
        where: { cycleId_employeeId: { cycleId, employeeId: emp.id } },
        update: {},
        create: {
          tenantId,
          cycleId,
          employeeId: emp.id,
          managerId: emp.managerId,
          status: 'IN_PROGRESS',
        },
      });
    }

    return {
      message: `Appraisal cycle started for ${employees.length} employees`,
    };
  }

  async getAppraisals(tenantId: string, actor: RequestUser, cycleId: string) {
    const where: any = { tenantId, cycleId };

    if (!isCompanyAdminUser(actor)) {
      assertHrAccess(hasPermissionRule(actor, 'appraisals:VIEW'));
    }

    return this.prisma.appraisal.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            avatarUrl: true,
          },
        },
        cycle: { select: { title: true } },
      },
    });
  }

  async getMyAppraisals(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: employeeId, tenantId },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    return this.prisma.appraisal.findMany({
      where: { tenantId, employeeId: employee.id },
      include: {
        cycle: { select: { title: true, startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitSelfAssessment(
    tenantId: string,
    appraisalId: string,
    userId: string,
    dto: SubmitReviewDto,
  ) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: { employee: true },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.employee.userId !== userId) {
      throw new BadRequestException(
        'You can only submit your own self-assessment',
      );
    }
    if (appraisal.selfStatus === 'SUBMITTED') {
      throw new BadRequestException('Self-assessment already submitted');
    }

    return this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        selfScore: dto.score,
        selfComment: dto.comment,
        selfStatus: 'SUBMITTED',
        selfSubmittedAt: new Date(),
      },
    });
  }

  async submitManagerReview(
    tenantId: string,
    appraisalId: string,
    reviewer: RequestUser,
    dto: SubmitReviewDto,
  ) {
    const appraisal = await this.prisma.appraisal.findFirst({
      where: { id: appraisalId, tenantId },
      include: { employee: { select: { id: true } } },
    });

    if (!appraisal) throw new NotFoundException('Appraisal not found');
    if (appraisal.managerStatus === 'SUBMITTED') {
      throw new BadRequestException('Manager review already submitted');
    }

    assertHrAccess(
      isCompanyAdminUser(reviewer) ||
        hasPermissionRule(reviewer, 'appraisals:EDIT'),
    );

    const finalScore = appraisal.selfScore
      ? Math.round((dto.score + appraisal.selfScore) / 2)
      : dto.score;

    return this.prisma.appraisal.update({
      where: { id: appraisalId },
      data: {
        managerId: reviewer.id,
        managerScore: dto.score,
        managerComment: dto.comment,
        managerStatus: 'SUBMITTED',
        managerSubmittedAt: new Date(),
        finalScore,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    tenantId: string,
    tenantSlug: string,
    firstName: string,
    tenantName: string,
  ) {
    const [totalEmployees, activeEmployees, pendingLeaveRequests] =
      await Promise.all([
        this.prisma.employee.count({ where: { tenantId } }),
        this.prisma.employee.count({
          where: { tenantId, employmentStatus: 'ACTIVE' },
        }),
        this.prisma.leaveRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
      ]);

    return {
      adminFirstName: firstName,
      companyName: tenantName,
      totalEmployees,
      activeEmployees,
      pendingLeaveRequests,
      assignedAssetsCount: 0, // Assets module not yet implemented
    };
  }
}

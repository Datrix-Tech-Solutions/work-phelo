import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditPayload {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'APPROVE'
    | 'REVOKE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'EXPORT'
    | 'ASSIGN'
    | 'RUN';
  resource: string;
  resourceId?: string;
  changes?: { before?: Record<string, any>; after?: Record<string, any> };
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: payload.tenantId,
          userId: payload.userId,
          userEmail: payload.userEmail,
          userRole: payload.userRole,
          action: payload.action as any,
          resource: payload.resource,
          resourceId: payload.resourceId,
          changes: payload.changes as any,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          status: (payload.status || 'SUCCESS') as any,
          failureReason: payload.failureReason,
        },
      });
    } catch (err) {
      // Audit failures must never crash the main operation
      this.logger.error('Failed to write audit log', err);
    }
  }

  async query(
    tenantId: string,
    filters: {
      resource?: string;
      userId?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const take = Math.min(filters.limit || 50, 200);
    const skip = ((filters.page || 1) - 1) * take;

    const where: any = { tenantId };
    if (filters.resource) where.resource = filters.resource;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      meta: {
        total,
        page: filters.page || 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ensurePermissionResources,
  reconcileTenantPermissionState,
} from './system-permission-sets';

export interface PermissionReconciliationOptions {
  execute?: boolean;
  tenantId?: string;
  afterTenantId?: string;
  limit?: number;
}

@Injectable()
export class SystemPermissionBackfillService {
  private readonly logger = new Logger(SystemPermissionBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Explicit operator entry point. There is deliberately no application lifecycle hook. */
  async run(options: PermissionReconciliationOptions = {}) {
    const limit = options.limit ?? 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('Reconciliation limit must be between 1 and 100');
    if (options.tenantId && options.afterTenantId)
      throw new Error('Choose a tenant or a resume cursor, not both');
    const started = Date.now();
    const tenants = await this.prisma.tenant.findMany({
      where: {
        ...(options.tenantId ? { id: options.tenantId } : {}),
        ...(options.afterTenantId ? { id: { gt: options.afterTenantId } } : {}),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    if (!options.execute)
      return {
        dryRun: true,
        tenants: tenants.map((t) => t.id),
        nextCursor: tenants.at(-1)?.id ?? null,
      };
    if (!tenants.length)
      return {
        dryRun: false,
        completed: 0,
        users: 0,
        nextCursor: options.afterTenantId ?? null,
        busy: false,
      };
    const resources = await ensurePermissionResources(this.prisma);
    let completed = 0;
    let users = 0;
    let nextCursor = options.afterTenantId ?? null;
    for (const tenant of tenants) {
      let result: number | null = null;
      const tenantStarted = Date.now();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await this.prisma.$transaction(
            async (tx) => {
              const [lock] = await tx.$queryRawUnsafe<{ locked: boolean }[]>(
                'SELECT pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) AS locked',
                'auth-permission-reconciliation',
                tenant.id,
              );
              if (!lock?.locked) return null;
              // Serialize role changes/deletions with assignment, never sync a stale/deleted user.
              await tx.$queryRawUnsafe(
                'SELECT id FROM w_auth."User" WHERE "tenantId" = $1 ORDER BY id FOR UPDATE',
                tenant.id,
              );
              return reconcileTenantPermissionState(
                tx,
                tenant.id,
                resources,
                this.logger,
              );
            },
            { timeout: 60000, maxWait: 5000 },
          );
          break;
        } catch (error) {
          const rawCode = (error as { code?: string }).code;
          const code =
            typeof rawCode === 'string' && /^P\d{4}$/.test(rawCode)
              ? rawCode
              : 'UNKNOWN';
          if (attempt === 2 || !['P2034', 'P2002'].includes(code ?? '')) {
            this.logger.error(
              `Permission reconciliation failed: completed=${completed} resumeAfter=${nextCursor ?? 'start'} code=${code ?? 'UNKNOWN'}`,
            );
            throw new Error(
              'Permission reconciliation failed; the current tenant transaction was rolled back. Resume from the last reported cursor.',
            );
          }
          this.logger.warn(
            `Permission reconciliation retry attempt=${attempt + 1} code=${code}`,
          );
        }
      }
      if (result === null) {
        this.logger.warn(
          `Permission reconciliation busy; completed=${completed} resumeAfter=${nextCursor ?? 'start'}`,
        );
        return { dryRun: false, completed, users, nextCursor, busy: true };
      }
      completed++;
      users += result;
      nextCursor = tenant.id;
      this.logger.log(
        `Permission reconciliation tenant completed=${completed} users=${result} durationMs=${Date.now() - tenantStarted} resumeAfter=${nextCursor}`,
      );
    }
    this.logger.log(
      `Permission reconciliation complete tenants=${completed} users=${users} totalMs=${Date.now() - started}`,
    );
    return { dryRun: false, completed, users, nextCursor, busy: false };
  }
}

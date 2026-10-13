import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const REINSURANCE_ACCOUNTING_INTEGRATION =
  'operations.reinsurance->accounting';

/**
 * Features a super admin can rename for a company, mapped to the module feature that must be
 * switched on first. Values are stored singular; the plural is derived by the UI.
 */
export const LABELLED_FEATURES: Record<
  string,
  { module: string; feature: string }
> = {
  projects: { module: 'hr', feature: 'projects' },
};

const LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} &'-]*$/u;
export const LABEL_MAX_LENGTH = 30;

@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async updateModules(
    tenantId: string,
    modules: Record<string, boolean>,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const currentConfig =
      (tenant.moduleConfig as Record<string, boolean>) ?? {};

    const changes: string[] = [];
    for (const [module, enabled] of Object.entries(modules)) {
      if (currentConfig[module] !== enabled) {
        changes.push(
          `${module}: ${currentConfig[module] ? 'enabled' : 'disabled'} → ${enabled ? 'enabled' : 'disabled'}`,
        );
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { moduleConfig: { ...currentConfig, ...modules } },
    });

    if (changes.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          tenantId,
          action: 'UPDATE',
          resource: 'Tenant',
          resourceId: tenantId,
          changes: { modules: changes, updatedConfig: updated.moduleConfig },
        },
      });
    }

    return {
      message: 'Module configuration updated successfully',
      moduleConfig: updated.moduleConfig,
    };
  }

  /** Which modules a tenant has switched on, for services that act on a tenant named in a path. */
  async getModuleConfig(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { moduleConfig: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return {
      moduleConfig: (tenant.moduleConfig as Record<string, boolean>) ?? {},
    };
  }

  /** Sets display names for module features. A blank value clears the name (falls back to default). */
  async updateLabels(
    tenantId: string,
    labels: Record<string, string>,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { moduleConfig: true, featureConfig: true, labelConfig: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const moduleConfig = (tenant.moduleConfig as Record<string, boolean>) ?? {};
    const featureConfig =
      (tenant.featureConfig as Record<string, Record<string, boolean>>) ?? {};
    const current = (tenant.labelConfig as Record<string, string>) ?? {};
    const next: Record<string, string> = { ...current };
    const changes: string[] = [];

    for (const [key, raw] of Object.entries(labels)) {
      const target = LABELLED_FEATURES[key];
      if (!target) {
        throw new BadRequestException(`"${key}" cannot be renamed.`);
      }
      if (
        !moduleConfig[target.module] ||
        !featureConfig[target.module]?.[target.feature]
      ) {
        throw new BadRequestException(
          `Enable ${key} for this company before naming it.`,
        );
      }

      const value =
        typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
      if (value.length > LABEL_MAX_LENGTH) {
        throw new BadRequestException(
          `The name must be ${LABEL_MAX_LENGTH} characters or fewer.`,
        );
      }
      if (value && !LABEL_PATTERN.test(value)) {
        throw new BadRequestException(
          'The name can only contain letters, numbers, spaces, &, apostrophes and hyphens.',
        );
      }

      if (value) next[key] = value;
      else delete next[key];

      if ((current[key] ?? '') !== value) {
        changes.push(`${key}: "${current[key] ?? ''}" → "${value}"`);
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { labelConfig: next },
    });

    if (changes.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          tenantId,
          action: 'UPDATE',
          resource: 'Tenant',
          resourceId: tenantId,
          changes: {
            type: 'LABEL_CONFIG_UPDATED',
            changes,
            updatedConfig: next,
          },
        },
      });
    }

    return {
      message: 'Names updated successfully',
      labelConfig: updated.labelConfig,
    };
  }

  async getReinsuranceAccountingIntegration(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        moduleConfig: true,
        featureConfig: true,
        integrationConfig: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const moduleConfig = (tenant.moduleConfig as Record<string, boolean>) ?? {};
    const featureConfig =
      (tenant.featureConfig as Record<string, Record<string, boolean>>) ?? {};
    const integrationConfig =
      (tenant.integrationConfig as Record<string, boolean>) ?? {};
    const reinsuranceEnabled = Boolean(
      moduleConfig.operations && featureConfig.operations?.reinsurance,
    );
    const accountingEnabled = Boolean(moduleConfig.accounting);
    const integrationEnabled = Boolean(
      integrationConfig[REINSURANCE_ACCOUNTING_INTEGRATION],
    );

    return {
      reinsuranceEnabled,
      accountingEnabled,
      integrationEnabled,
      active: reinsuranceEnabled && accountingEnabled && integrationEnabled,
    };
  }

  async updateReinsuranceAccountingIntegration(
    tenantId: string,
    enabled: boolean,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { integrationConfig: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const current = (tenant.integrationConfig as Record<string, boolean>) ?? {};
    const previousEnabled = Boolean(
      current[REINSURANCE_ACCOUNTING_INTEGRATION],
    );
    const integrationConfig = {
      ...current,
      [REINSURANCE_ACCOUNTING_INTEGRATION]: enabled,
    };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { integrationConfig },
    });

    if (previousEnabled !== enabled) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          tenantId,
          action: 'UPDATE',
          resource: 'TenantModuleIntegration',
          resourceId: `${tenantId}:${REINSURANCE_ACCOUNTING_INTEGRATION}`,
          changes: {
            type: 'REINSURANCE_ACCOUNTING_INTEGRATION_UPDATED',
            integration: REINSURANCE_ACCOUNTING_INTEGRATION,
            previousEnabled,
            enabled,
          },
        },
      });
    }

    return this.getReinsuranceAccountingIntegration(tenantId);
  }

  async updateFeatures(
    tenantId: string,
    module: string,
    features: Record<string, boolean>,
    actorId: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const moduleConfig = (tenant.moduleConfig as Record<string, boolean>) ?? {};
    if (!moduleConfig[module]) {
      throw new BadRequestException(
        `The ${module} module is not enabled for this company.`,
      );
    }

    const currentFeatures =
      (tenant.featureConfig as Record<string, Record<string, boolean>>) ?? {};
    const currentModuleFeatures = currentFeatures[module] ?? {};

    const merged = { ...currentModuleFeatures, ...features };
    const enabledCount = Object.values(merged).filter(Boolean).length;
    if (enabledCount === 0) {
      throw new BadRequestException(
        `At least one feature must be enabled within the ${module} module.`,
      );
    }

    const updatedFeatureConfig = { ...currentFeatures, [module]: merged };

    const changes: string[] = [];
    for (const [feature, enabled] of Object.entries(features)) {
      if (currentModuleFeatures[feature] !== enabled) {
        changes.push(
          `${module}.${feature}: ${currentModuleFeatures[feature] ? 'enabled' : 'disabled'} → ${enabled ? 'enabled' : 'disabled'}`,
        );
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { featureConfig: updatedFeatureConfig },
    });

    if (changes.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          tenantId,
          action: 'UPDATE',
          resource: 'Tenant',
          resourceId: tenantId,
          changes: {
            type: 'FEATURE_CONFIG_UPDATED',
            module,
            changes,
            updatedConfig: updatedFeatureConfig,
          },
        },
      });
    }

    return {
      message: 'Feature configuration updated successfully',
      featureConfig: updated.featureConfig,
    };
  }

  async getFeatureHistory(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: 'UPDATE',
        resource: 'Tenant',
        resourceId: tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      history: logs
        .filter(
          (l) =>
            (l.changes as Record<string, unknown> | null)?.type ===
            'FEATURE_CONFIG_UPDATED',
        )
        .map((l) => {
          const changes = l.changes as Record<string, unknown> | null;
          return {
            id: l.id,
            actorId: l.userId,
            changes: (changes?.changes as unknown[]) ?? [],
            module: changes?.module,
            timestamp: l.createdAt,
          };
        }),
    };
  }
}

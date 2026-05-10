import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const MODULE_KEY = 'module';
export const FEATURE_KEY = 'feature';

interface FeatureRequirement {
  module: string;
  feature: string;
}

/**
 * Composite HR module and feature guard.
 * Applies module check first, then feature check.
 * SUPER_ADMIN and TENANT_ADMIN bypass both checks.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, HrAccessGuard)
 * @RequireHrFeature({ module: 'hr', feature: 'leave' })
 * async getLeaveRequests() { ... }
 */
@Injectable()
export class HrAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // SUPER_ADMIN and TENANT_ADMIN bypass
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    // Check required module
    const requiredModule = this.reflector.get<string>(
      MODULE_KEY,
      context.getHandler(),
    );
    if (requiredModule) {
      const moduleConfig = user.moduleConfig as
        | Record<string, boolean>
        | undefined;
      if (!moduleConfig || !moduleConfig[requiredModule]) {
        throw new ForbiddenException(
          `The ${requiredModule} module is not available for your company.`,
        );
      }
    }

    // Check required feature
    const requiredFeature = this.reflector.get<FeatureRequirement>(
      FEATURE_KEY,
      context.getHandler(),
    );
    if (requiredFeature) {
      const featureConfig = (
        user.featureConfig as
          | Record<string, Record<string, boolean>>
          | undefined
      )?.[requiredFeature.module];
      if (!featureConfig || !featureConfig[requiredFeature.feature]) {
        throw new ForbiddenException(
          `The ${requiredFeature.feature} feature is not available for your company.`,
        );
      }
    }

    return true;
  }
}

/**
 * Decorator to require a specific HR module.
 * Usage: @RequireHrModule('hr')
 */
export const RequireHrModule = (module: string) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(MODULE_KEY, module, descriptor.value);
  };
};

/**
 * Decorator to require a specific HR feature.
 * Usage: @RequireHrFeature({ module: 'hr', feature: 'leave' })
 */
export const RequireHrFeature = (requirement: FeatureRequirement) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(FEATURE_KEY, requirement, descriptor.value);
  };
};

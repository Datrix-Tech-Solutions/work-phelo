import { Module } from '@nestjs/common';
import { InternalServiceAuthGuard } from './internal-service-auth';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ModuleGuard } from './guards/module.guard';
import { FeatureGuard } from './guards/feature.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  providers: [InternalServiceAuthGuard, JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard],
  exports: [InternalServiceAuthGuard, JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard],
})
export class AuthModule {}

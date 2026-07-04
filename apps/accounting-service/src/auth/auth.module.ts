import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ModuleGuard } from './guards/module.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  providers: [JwtAuthGuard, ModuleGuard, PermissionsGuard],
  exports: [JwtAuthGuard, ModuleGuard, PermissionsGuard],
})
export class AuthModule {}

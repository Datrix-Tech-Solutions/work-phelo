import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsInternalController } from './permissions-internal.controller';
import { PermissionsHandler } from './permissions.handler';
import { SystemPermissionBackfillService } from './system-permission-backfill.service';

@Module({
  controllers: [
    PermissionsController,
    PermissionsInternalController,
    PermissionsHandler,
  ],
  providers: [PermissionsService, SystemPermissionBackfillService],
  exports: [PermissionsService],
})
export class PermissionsModule {}

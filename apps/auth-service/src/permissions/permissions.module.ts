import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { SystemPermissionBackfillService } from './system-permission-backfill.service';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, SystemPermissionBackfillService],
  exports: [PermissionsService],
})
export class PermissionsModule {}

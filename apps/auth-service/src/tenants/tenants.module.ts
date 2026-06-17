import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantLifecycleService } from './tenant-lifecycle.service';
import { TenantConfigService } from './tenant-config.service';
import { TenantAdminService } from './tenant-admin.service';
import { TenantBrandingService } from './tenant-branding.service';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RabbitMQModule, AuditModule],
  controllers: [TenantsController],
  providers: [
    TenantLifecycleService,
    TenantConfigService,
    TenantAdminService,
    TenantBrandingService,
  ],
  exports: [TenantLifecycleService],
})
export class TenantsModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeaveModule } from '../leave/leave.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CryptoModule } from '../crypto/crypto.module';
import { EmployeesService } from './employees.service';
import { DriverLicenceService } from './driver-licence.service';
import { EmployeesController } from './employees.controller';
import { EmployeeSyncRecoveryCronService } from './employee-sync-recovery.cron';
import { AvatarUrlResolverService } from '../common/avatar-url-resolver.service';
import { EmployeeDocumentStorageService } from '../common/employee-document-storage.service';
import {
  RESIGNATION_QUEUE,
  ResignationNotificationProcessor,
} from './resignation-notification.processor';

@Module({
  imports: [
    LeaveModule,
    RabbitMQModule,
    NotificationsModule,
    CryptoModule,
    BullModule.registerQueue({ name: RESIGNATION_QUEUE }),
  ],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    DriverLicenceService,
    EmployeeSyncRecoveryCronService,
    ResignationNotificationProcessor,
    AvatarUrlResolverService,
    EmployeeDocumentStorageService,
  ],
  exports: [EmployeesService, DriverLicenceService],
})
export class EmployeesModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { DepartmentsModule } from './departments/departments.module';
import { BranchesModule } from './branches/branches.module';
import { EmployeesModule } from './employees/employees.module';
import { LeaveModule } from './leave/leave.module';
import { TimeModule } from './time/time.module';
import { PayrollModule } from './payroll/payroll.module';
import { AppraisalsModule } from './appraisals/appraisals.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RabbitMQModule } from './messaging/rabbitmq.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { AssetsModule } from './assets/assets.module';
import { CompanyPoliciesModule } from './company-policies/company-policies.module';
import { ModuleGuard } from './auth/guards/module.guard';
import { FeatureGuard } from './auth/guards/feature.guard';
import { RabbitMQSetupService } from './messaging/rabbitmq-setup.service';
import { HealthModule } from './health/health.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL as string },
    }),
    PrismaModule,
    DepartmentsModule,
    BranchesModule,
    EmployeesModule,
    LeaveModule,
    TimeModule,
    PayrollModule,
    AppraisalsModule,
    DashboardModule,
    AssetsModule,
    CompanyPoliciesModule,
    RabbitMQModule,
    AnnouncementsModule,
    NotificationsModule,
    SchedulingModule,
    HealthModule,
    SettingsModule,
  ],
  providers: [
    RabbitMQSetupService,
    ModuleGuard,
    FeatureGuard,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}

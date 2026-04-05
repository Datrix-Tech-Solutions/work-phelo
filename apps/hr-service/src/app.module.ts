import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { LeaveModule } from './leave/leave.module';
import { TimeModule } from './time/time.module';
import { PayrollModule } from './payroll/payroll.module';
import { AppraisalsModule } from './appraisals/appraisals.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RabbitMQModule } from './messaging/rabbitmq.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ModuleGuard } from './auth/guards/module.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DepartmentsModule,
    EmployeesModule,
    LeaveModule,
    TimeModule,
    PayrollModule,
    AppraisalsModule,
    DashboardModule,
    RabbitMQModule,
    AnnouncementsModule,
  ],
  providers: [
    ModuleGuard,
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

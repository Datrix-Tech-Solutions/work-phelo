import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { LeaveModule } from './leave/leave.module';
import { PayrollModule } from './payroll/payroll.module';
import { ClockingModule } from './clocking/clocking.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { AppraisalModule } from './appraisal/appraisal.module';
import { ProjectsModule } from './projects/projects.module';
import { AssetsModule } from './assets/assets.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmployeesModule,
    DepartmentsModule,
    LeaveModule,
    PayrollModule,
    ClockingModule,
    SchedulingModule,
    AppraisalModule,
    ProjectsModule,
    AssetsModule,
    OnboardingModule,
  ],
})
export class AppModule {}

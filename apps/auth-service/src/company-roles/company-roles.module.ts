import { Module } from '@nestjs/common';
import { CompanyRolesService } from './company-roles.service';
import { CompanyRolesController } from './company-roles.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CompanyRolesController],
  providers: [CompanyRolesService],
  exports: [CompanyRolesService],
})
export class CompanyRolesModule {}

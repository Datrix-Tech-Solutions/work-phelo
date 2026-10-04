import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { AssigneesController } from './assignees.controller';
import { AssigneesService } from './assignees.service';

@Module({
  imports: [AuthModule],
  controllers: [AssigneesController],
  providers: [AssigneesService, HrDirectoryClient],
  exports: [AssigneesService],
})
export class AssigneesModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthDirectoryClient } from '../appointments/auth-directory.client';
import { AuthUsersClient } from './auth-users.client';
import { AssigneesController } from './assignees.controller';
import { AssigneesService } from './assignees.service';

@Module({
  imports: [AuthModule],
  controllers: [AssigneesController],
  providers: [AssigneesService, AuthDirectoryClient, AuthUsersClient],
  exports: [AssigneesService],
})
export class AssigneesModule {}

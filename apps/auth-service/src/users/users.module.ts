import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersHandler } from './users.handler';
import { AuthModule } from '../auth/auth.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, RabbitMQModule, AuditModule],
  controllers: [UsersController, UsersHandler],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { RabbitMQModule } from '../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, RabbitMQModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

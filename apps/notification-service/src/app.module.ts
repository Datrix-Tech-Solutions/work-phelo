import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationModule } from './notification/notification.module';
import { RabbitMQSetupService } from './messaging/rabbitmq-setup.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificationModule,
  ],
  providers: [RabbitMQSetupService],
})
export class AppModule {}

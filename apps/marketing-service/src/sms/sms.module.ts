import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsSenderIdentitiesController } from './sms-sender-identities.controller';
import { SmsSenderIdentitiesService } from './sms-sender-identities.service';
import { SmsWalletController } from './sms-wallet.controller';
import { SmsWalletService } from './sms-wallet.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SmsSenderIdentitiesController, SmsWalletController],
  providers: [SmsSenderIdentitiesService, SmsWalletService],
  exports: [SmsSenderIdentitiesService, SmsWalletService],
})
export class SmsModule {}

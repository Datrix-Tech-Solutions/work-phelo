import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MessageContextFactory } from './message-context';
import { MessageEncryptionService } from './message-encryption.service';
import { MessageKeyRing } from './key-ring.service';

@Module({
  imports: [ConfigModule],
  providers: [MessageKeyRing, MessageContextFactory, MessageEncryptionService],
  exports: [MessageContextFactory, MessageEncryptionService],
})
export class MessageEncryptionModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TrustedAuthModule } from '../auth/trusted-auth.module';
import { AI_CLIENT_FACTORY, AiDatabaseService, createAiClient } from './ai-database.service';
import { OwnershipContextFactory } from './ownership-context';
import { ConversationsRepository } from './conversations.repository';
import { MessageEncryptionModule } from '../encryption/encryption.module';
import { SubmissionFingerprintService } from './submission-fingerprint.service';
import { ConversationOperationsService } from './conversation-operations.service';
import { RetentionCleanupService } from './retention-cleanup.service';
import { RequestNonceStore } from './request-nonce.store';

@Module({
  imports: [ConfigModule, TrustedAuthModule, MessageEncryptionModule],
  providers: [
    { provide: AI_CLIENT_FACTORY, useValue: createAiClient },
    AiDatabaseService,
    OwnershipContextFactory,
    ConversationsRepository,
    SubmissionFingerprintService,
    ConversationOperationsService,
    RetentionCleanupService,
    RequestNonceStore,
  ],
  exports: [
    OwnershipContextFactory,
    ConversationsRepository,
    ConversationOperationsService,
    RequestNonceStore,
  ],
})
export class PersistenceModule {}

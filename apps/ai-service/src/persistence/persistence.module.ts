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
import { ExecutionPermits } from './execution-permits.service';
import { ResourceReconciliationService } from './resource-reconciliation.service';
import { InferenceModule } from '../inference/inference.module';

@Module({
  imports: [ConfigModule, TrustedAuthModule, MessageEncryptionModule, InferenceModule],
  providers: [
    { provide: AI_CLIENT_FACTORY, useValue: createAiClient },
    AiDatabaseService,
    OwnershipContextFactory,
    ConversationsRepository,
    SubmissionFingerprintService,
    ConversationOperationsService,
    RetentionCleanupService,
    RequestNonceStore,
    ExecutionPermits,
    ResourceReconciliationService,
  ],
  exports: [
    OwnershipContextFactory,
    ConversationsRepository,
    ConversationOperationsService,
    RequestNonceStore,
    ExecutionPermits,
  ],
})
export class PersistenceModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersistenceModule } from '../persistence/persistence.module';
import { RequestIntegrityModule } from '../request-integrity/request-integrity.module';
import { ConversationsController } from '../conversations/conversations.controller';
import { conversationBindings } from '../conversations/conversation-bindings';
import { ConversationHandlerRegistry, CONVERSATION_HANDLERS } from './conversation-handler.policy';
import {
  AuthorizedConversationOperations,
  ConversationAuthorizationService,
} from './conversation-authorization.service';

@Module({
  imports: [ConfigModule, PersistenceModule, RequestIntegrityModule],
  controllers: [ConversationsController],
  providers: [
    { provide: CONVERSATION_HANDLERS, useValue: conversationBindings },
    ConversationHandlerRegistry,
    ConversationAuthorizationService,
    AuthorizedConversationOperations,
  ],
  exports: [ConversationAuthorizationService, AuthorizedConversationOperations],
})
export class ConversationAuthorizationModule {}

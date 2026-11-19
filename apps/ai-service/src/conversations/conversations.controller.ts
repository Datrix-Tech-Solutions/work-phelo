import { Controller, Delete, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  AuthorizedConversationOperations,
  conversationGrant,
} from '../security/conversation-authorization.service';
import { ConversationPolicy } from '../security/conversation-handler.policy';
import {
  AppendConversationMessageDto,
  conversationBody,
  conversationPage,
  CreateConversationDto,
  idempotencyKey,
  noConversationQuery,
} from './conversation.dto';
import { listPosition, messagePosition } from '../persistence/conversation-pagination';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly operations: AuthorizedConversationOperations) {}
  @Post() @ConversationPolicy('create') create(@Req() request: Request) {
    noConversationQuery(request);
    conversationBody(request, CreateConversationDto);
    return this.operations.createIdempotent(
      conversationGrant(request, 'create'),
      idempotencyKey(request),
    );
  }
  @Get() @ConversationPolicy('list') list(@Req() request: Request) {
    const query = conversationPage(request);
    listPosition(query.cursor);
    return this.operations.listPage(conversationGrant(request, 'list'), query.limit, query.cursor);
  }
  @Get(':conversationId') @ConversationPolicy('read') read(@Req() request: Request) {
    const query = conversationPage(request);
    return this.operations.detail(
      conversationGrant(request, 'read'),
      messagePosition(query.cursor),
      query.limit,
    );
  }
  @Post(':conversationId/messages') @ConversationPolicy('append') append(@Req() request: Request) {
    noConversationQuery(request);
    const body = conversationBody(request, AppendConversationMessageDto);
    return this.operations.append(
      conversationGrant(request, 'append'),
      body.content,
      idempotencyKey(request),
    );
  }
  @Delete(':conversationId') @HttpCode(204) @ConversationPolicy('delete') remove(
    @Req() request: Request,
  ) {
    conversationPage(request, false);
    return this.operations.delete(conversationGrant(request, 'delete'));
  }
}

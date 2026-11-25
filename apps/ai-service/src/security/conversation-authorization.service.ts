import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  RequestIntegrityService,
  requireConsumedAiRequest,
  VerifiedAiRequest,
} from '../request-integrity/request-integrity.service';
import { OwnershipContext, OwnershipContextFactory } from '../persistence/ownership-context';
import { ConversationsRepository } from '../persistence/conversations.repository';
import { ConversationOperationsService } from '../persistence/conversation-operations.service';
import { ConversationHandlerRegistry, ConversationOperation } from './conversation-handler.policy';
import { ExecutionPermits } from '../persistence/execution-permits.service';

declare const grantBrand: unique symbol;
export interface ConversationGrant<Operation extends ConversationOperation> {
  readonly [grantBrand]: Operation;
}
type GrantState = Readonly<{
  operation: ConversationOperation;
  owner: OwnershipContext;
  proof: VerifiedAiRequest;
  conversationId?: string;
}>;
const grants = new WeakMap<object, GrantState>();
const requests = new WeakMap<Request, object>();

// No mutable request property or decorator can mint an operation capability.
export function conversationGrant<Operation extends ConversationOperation>(
  request: Request,
  operation: Operation,
): ConversationGrant<Operation> {
  const grant = requests.get(request);
  if (!grant || grants.get(grant)?.operation !== operation) throw new ForbiddenException();
  requireConsumedAiRequest(grants.get(grant)!.proof);
  return grant as ConversationGrant<Operation>;
}

@Injectable()
export class ConversationAuthorizationService {
  constructor(
    private readonly registry: ConversationHandlerRegistry,
    private readonly config: ConfigService,
    private readonly integrity: RequestIntegrityService,
    private readonly ownership: OwnershipContextFactory,
  ) {}
  async authorize(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    requests.delete(request);
    const match = this.registry.match(context);
    if (this.config.get<unknown>('NODE_ENV') === 'production')
      throw new ServiceUnavailableException();
    for (const key of [
      'AI_CONVERSATION_HTTP_ENABLED',
      'AI_RESOURCE_SAFEGUARDS_ENABLED',
      'AI_AUTHENTICATED_ROUTES_ENABLED',
      'AI_PERSISTENCE_ENABLED',
      'AI_MESSAGE_ENCRYPTION_ENABLED',
      'AI_MESSAGE_OPERATIONS_ENABLED',
      'AI_REQUEST_VERIFICATION_ENABLED',
    ]) {
      if (this.config.get<unknown>(key) !== true) throw new ServiceUnavailableException();
    }
    const proof = await this.integrity.authenticateAndConsume(request);
    const owner = this.ownership.fromConsumedRequest(proof);
    const grant = Object.freeze({});
    grants.set(grant, Object.freeze({ ...match, proof, owner }));
    requests.set(request, grant);
    context
      .switchToHttp()
      .getResponse<{ setHeader(name: string, value: string): void }>()
      .setHeader('Cache-Control', 'no-store');
    return true;
  }
}

@Injectable()
export class AuthorizedConversationOperations {
  constructor(
    private readonly repository: ConversationsRepository,
    private readonly operations: ConversationOperationsService,
    private readonly permits: ExecutionPermits,
  ) {}
  private require<Operation extends ConversationOperation>(
    grant: ConversationGrant<Operation>,
    operation: Operation,
  ): GrantState {
    const state = grants.get(grant);
    if (!state || state.operation !== operation) throw new ForbiddenException();
    requireConsumedAiRequest(state.proof);
    return state;
  }
  create(grant: ConversationGrant<'create'>) {
    const owner = this.require(grant, 'create').owner;
    return this.permits.run(owner, () => this.repository.create(owner));
  }
  createIdempotent(grant: ConversationGrant<'create'>, key: string) {
    const owner = this.require(grant, 'create').owner;
    return this.permits.run(owner, () => this.operations.createConversation(owner, key));
  }
  listPage(grant: ConversationGrant<'list'>, limit = 20, cursor?: string) {
    const owner = this.require(grant, 'list').owner;
    return this.permits.run(owner, () => this.repository.listOwnedPage(owner, limit, cursor));
  }
  async detail(grant: ConversationGrant<'read'>, afterSequence = 0, limit = 20) {
    const state = this.require(grant, 'read');
    const result = await this.permits.run(state.owner, () =>
      this.operations.readOwnedDetail(state.owner, state.conversationId!, afterSequence, limit),
    );
    return {
      conversation: result.conversation,
      messages: { items: result.messages.items, nextCursor: result.messages.nextCursor },
    };
  }
  list(grant: ConversationGrant<'list'>, limit = 20) {
    const owner = this.require(grant, 'list').owner;
    return this.permits.run(owner, () => this.repository.listOwned(owner, limit));
  }
  async read(grant: ConversationGrant<'read'>, afterSequence = 0, limit = 20) {
    const state = this.require(grant, 'read');
    return this.permits.run(state.owner, async () => {
      const conversation = await this.repository.requireOwned(state.owner, state.conversationId!);
      this.require(grant, 'read');
      const messages = await this.operations.readOwnedMessagePage(
        state.owner,
        state.conversationId!,
        afterSequence,
        limit,
      );
      return { conversation, messages };
    });
  }
  append(grant: ConversationGrant<'append'>, content: string, idempotencyKey: string) {
    const state = this.require(grant, 'append');
    return this.permits.run(state.owner, () =>
      this.operations.appendUserMessage(
        state.owner,
        state.conversationId!,
        content,
        idempotencyKey,
      ),
    );
  }
  delete(grant: ConversationGrant<'delete'>) {
    const state = this.require(grant, 'delete');
    return this.permits.run(state.owner, () =>
      this.operations.deleteOwned(state.owner, state.conversationId!),
    );
  }
}

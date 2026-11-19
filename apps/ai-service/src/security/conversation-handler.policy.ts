import {
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  RequestMethod,
  SetMetadata,
  Type,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Request } from 'express';

export const CONVERSATION_POLICY = Symbol('CONVERSATION_POLICY');
export const CONVERSATION_HANDLERS = Symbol('CONVERSATION_HANDLERS');
export const conversationSpecifications = Object.freeze({
  create: Object.freeze({ method: 'POST', path: '/api/conversations' }),
  list: Object.freeze({ method: 'GET', path: '/api/conversations' }),
  read: Object.freeze({ method: 'GET', path: '/api/conversations/:conversationId' }),
  append: Object.freeze({ method: 'POST', path: '/api/conversations/:conversationId/messages' }),
  delete: Object.freeze({ method: 'DELETE', path: '/api/conversations/:conversationId' }),
});
export type ConversationOperation = keyof typeof conversationSpecifications;
export const ConversationPolicy = (operation: ConversationOperation) =>
  SetMetadata(CONVERSATION_POLICY, operation);
export interface ConversationHandlerBinding {
  readonly controller: Type<object>;
  readonly handler: (...args: never[]) => unknown;
  readonly operation: ConversationOperation;
  readonly method: string;
  readonly path: string;
}

@Injectable()
export class ConversationHandlerRegistry {
  private readonly bindings: readonly Readonly<ConversationHandlerBinding>[];
  constructor(@Inject(CONVERSATION_HANDLERS) bindings: readonly ConversationHandlerBinding[]) {
    this.bindings = Object.freeze(bindings.map((binding) => Object.freeze({ ...binding })));
  }

  match(
    context: ExecutionContext,
  ): Readonly<{ operation: ConversationOperation; conversationId?: string }> {
    const request = context.switchToHttp().getRequest<Request>();
    const matches = this.bindings.filter(
      (entry) => entry.controller === context.getClass() && entry.handler === context.getHandler(),
    );
    if (matches.length !== 1) throw new ForbiddenException();
    const binding = matches[0];
    const spec = conversationSpecifications[binding.operation];
    const controllerPath: unknown = Reflect.getOwnMetadata(PATH_METADATA, binding.controller);
    const handlerPath: unknown = Reflect.getOwnMetadata(PATH_METADATA, binding.handler);
    const declaredMethod: unknown = Reflect.getOwnMetadata(METHOD_METADATA, binding.handler);
    const policy: unknown = Reflect.getOwnMetadata(CONVERSATION_POLICY, binding.handler);
    const route: unknown = request.route;
    const routePath =
      route && typeof route === 'object' && 'path' in route ? route.path : undefined;
    // Nest permits aliases, inherited handlers, case-insensitive routes and implicit HEAD.
    // None of those routing conveniences grant conversation authority.
    if (
      !spec ||
      policy !== binding.operation ||
      binding.method !== spec.method ||
      binding.path !== spec.path ||
      request.method !== spec.method ||
      declaredMethod !== RequestMethod[spec.method as keyof typeof RequestMethod] ||
      controllerPath !== 'conversations' ||
      typeof handlerPath !== 'string' ||
      `/api/conversations${handlerPath === '/' ? '' : '/' + handlerPath}` !== spec.path ||
      routePath !== spec.path
    )
      throw new ForbiddenException();
    const target = request.originalUrl;
    const path = target.split('?')[0];
    const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
    const match = new RegExp(`^${spec.path.replace(':conversationId', `(${uuid})`)}$`).exec(path);
    if (!match) throw new ForbiddenException();
    return Object.freeze({
      operation: binding.operation,
      ...(match[1] ? { conversationId: match[1] } : {}),
    });
  }
}

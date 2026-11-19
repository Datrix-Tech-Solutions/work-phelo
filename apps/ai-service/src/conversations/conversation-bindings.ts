import { ConversationsController } from './conversations.controller';
import {
  ConversationHandlerBinding,
  ConversationOperation,
  conversationSpecifications,
} from '../security/conversation-handler.policy';

function handler(name: keyof ConversationsController) {
  return Object.getOwnPropertyDescriptor(ConversationsController.prototype, name)?.value as (
    ...args: never[]
  ) => unknown;
}
const handlers = {
  create: handler('create'),
  list: handler('list'),
  read: handler('read'),
  append: handler('append'),
  delete: handler('remove'),
} as const;
export const conversationBindings: readonly ConversationHandlerBinding[] = Object.freeze(
  (Object.keys(handlers) as ConversationOperation[]).map((operation) =>
    Object.freeze({
      controller: ConversationsController,
      handler: handlers[operation],
      operation,
      ...conversationSpecifications[operation],
    }),
  ),
);

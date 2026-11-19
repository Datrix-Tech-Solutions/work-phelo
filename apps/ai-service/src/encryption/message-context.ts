import { Injectable } from '@nestjs/common';
import { OwnershipContext, requireOwnership } from '../persistence/ownership-context';
import { MessageEncryptionError } from './encryption-error';

export interface MessageStorageMetadata {
  conversationId: string;
  messageId: string;
  role: 'USER';
  sequence: number;
}
declare const contextBrand: unique symbol;
export interface MessageEncryptionContext {
  readonly [contextBrand]: true;
}
const contexts = new WeakMap<
  MessageEncryptionContext,
  Readonly<MessageStorageMetadata & { tenantId: string; ownerUserId: string }>
>();
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

@Injectable()
export class MessageContextFactory {
  forMessage(owner: OwnershipContext, metadata: MessageStorageMetadata): MessageEncryptionContext {
    try {
      const identity = requireOwnership(owner);
      if (
        !metadata ||
        typeof metadata !== 'object' ||
        Array.isArray(metadata) ||
        Object.keys(metadata).sort().join(',') !== 'conversationId,messageId,role,sequence'
      )
        throw new Error();
      const { conversationId, messageId, role, sequence } = metadata;
      if (
        typeof conversationId !== 'string' ||
        !uuid.test(conversationId) ||
        typeof messageId !== 'string' ||
        !uuid.test(messageId) ||
        role !== 'USER' ||
        !Number.isInteger(sequence) ||
        sequence < 1 ||
        sequence > 2147483647
      )
        throw new Error();
      const context = Object.freeze({}) as MessageEncryptionContext;
      contexts.set(
        context,
        Object.freeze({ ...identity, conversationId, messageId, role, sequence }),
      );
      return context;
    } catch {
      throw new MessageEncryptionError('INVALID_CONTEXT');
    }
  }
}

export function messageAad(
  context: MessageEncryptionContext,
  version: number,
  keyId: string,
): Buffer {
  const metadata = contexts.get(context);
  if (!metadata) throw new MessageEncryptionError('INVALID_CONTEXT');
  return Buffer.from(
    JSON.stringify([
      'workphelo.ai.message',
      1,
      metadata.tenantId,
      metadata.ownerUserId,
      metadata.conversationId,
      metadata.messageId,
      metadata.role,
      metadata.sequence,
      version,
      keyId,
    ]),
    'utf8',
  );
}

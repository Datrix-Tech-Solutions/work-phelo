import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createSecretKey, KeyObject, timingSafeEqual } from 'crypto';
import { parseEncryptionKeys } from '../encryption/key-ring.config';
import { ConversationOperationError } from './conversation-operation.error';

export function parseFingerprintKeys(env: Record<string, unknown>) {
  const parsed = parseEncryptionKeys({
    ...env,
    AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: env.AI_FINGERPRINT_ACTIVE_KEY_ID,
    AI_MESSAGE_ENCRYPTION_KEYS: env.AI_FINGERPRINT_KEYS,
  });
  try {
    const encryption = parseEncryptionKeys(env);
    try {
      if (parsed.keys.some((key) => encryption.keys.some((other) => other.id === key.id)))
        throw new Error();
    } finally {
      for (const key of encryption.keys) key.material.fill(0);
    }
    return parsed;
  } catch {
    for (const key of parsed.keys) key.material.fill(0);
    throw new Error('Invalid AI fingerprint configuration');
  }
}

export interface AppendFingerprintInput {
  tenantId: string;
  ownerUserId: string;
  conversationId: string;
  content: string;
}

@Injectable()
export class SubmissionFingerprintService {
  private readonly keys = new Map<string, KeyObject>();
  private readonly activeId?: string;

  constructor(config: ConfigService) {
    if (config.get<unknown>('AI_MESSAGE_OPERATIONS_ENABLED') !== true) return;
    try {
      if (
        config.get<unknown>('AI_PERSISTENCE_ENABLED') !== true ||
        config.get<unknown>('AI_MESSAGE_ENCRYPTION_ENABLED') !== true
      )
        throw new Error();
      const env = Object.fromEntries(
        [
          'AI_FINGERPRINT_ACTIVE_KEY_ID',
          'AI_FINGERPRINT_KEYS',
          'AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID',
          'AI_MESSAGE_ENCRYPTION_KEYS',
          'JWT_SECRET',
          'FIELD_ENCRYPTION_KEY',
          'HR_FIELD_ENCRYPTION_KEY',
          'REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY',
        ].map((name) => [name, config.get<unknown>(name)]),
      );
      const parsed = parseFingerprintKeys(env);
      try {
        for (const { id, material } of parsed.keys) this.keys.set(id, createSecretKey(material));
        this.activeId = parsed.activeId;
      } finally {
        for (const { material } of parsed.keys) material.fill(0);
      }
    } catch {
      throw new ConversationOperationError(503);
    }
  }

  requireEnabled(): void {
    if (!this.activeId) throw new ConversationOperationError(503);
  }

  private digest(input: AppendFingerprintInput, keyId: string) {
    const key = this.keys.get(keyId);
    if (!key) throw new ConversationOperationError(503);
    return createHmac('sha256', key)
      .update(
        JSON.stringify([
          'workphelo.ai.append-message',
          1,
          input.tenantId,
          input.ownerUserId,
          input.conversationId,
          'USER',
          input.content,
        ]),
        'utf8',
      )
      .digest();
  }

  create(input: AppendFingerprintInput) {
    this.requireEnabled();
    return {
      fingerprintVersion: 1,
      fingerprintKeyId: this.activeId!,
      requestFingerprint: this.digest(input, this.activeId!),
    };
  }

  verify(
    input: AppendFingerprintInput,
    stored: {
      fingerprintVersion: number;
      fingerprintKeyId: string;
      requestFingerprint: Buffer;
    },
  ): void {
    this.requireEnabled();
    if (
      stored.fingerprintVersion !== 1 ||
      !Buffer.isBuffer(stored.requestFingerprint) ||
      stored.requestFingerprint.length !== 32
    )
      throw new ConversationOperationError(503);
    const expected = this.digest(input, stored.fingerprintKeyId);
    if (!timingSafeEqual(expected, stored.requestFingerprint))
      throw new ConversationOperationError(409);
  }

  private creationDigest(owner: { tenantId: string; ownerUserId: string }, keyId: string) {
    const key = this.keys.get(keyId);
    if (!key) throw new ConversationOperationError(503);
    return createHmac('sha256', key)
      .update(
        JSON.stringify([
          'workphelo.ai.create-conversation',
          1,
          owner.tenantId,
          owner.ownerUserId,
          {},
        ]),
        'utf8',
      )
      .digest();
  }
  createConversation(owner: { tenantId: string; ownerUserId: string }) {
    this.requireEnabled();
    return {
      fingerprintVersion: 1,
      fingerprintKeyId: this.activeId!,
      requestFingerprint: this.creationDigest(owner, this.activeId!),
    };
  }
  verifyConversation(
    owner: { tenantId: string; ownerUserId: string },
    stored: { fingerprintVersion: number; fingerprintKeyId: string; requestFingerprint: Buffer },
  ) {
    this.requireEnabled();
    if (
      stored.fingerprintVersion !== 1 ||
      !Buffer.isBuffer(stored.requestFingerprint) ||
      stored.requestFingerprint.length !== 32
    )
      throw new ConversationOperationError(503);
    if (
      !timingSafeEqual(
        this.creationDigest(owner, stored.fingerprintKeyId),
        stored.requestFingerprint,
      )
    )
      throw new ConversationOperationError(409);
  }
}

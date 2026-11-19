import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSecretKey, KeyObject } from 'crypto';
import { MessageEncryptionError } from './encryption-error';
import { parseEncryptionKeys } from './key-ring.config';

@Injectable()
export class MessageKeyRing {
  private readonly keys = new Map<string, KeyObject>();
  private readonly activeId?: string;

  constructor(config: ConfigService) {
    if (config.get<unknown>('AI_MESSAGE_ENCRYPTION_ENABLED') !== true) return;
    try {
      const parsed = parseEncryptionKeys(
        Object.fromEntries(
          [
            'AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID',
            'AI_MESSAGE_ENCRYPTION_KEYS',
            'JWT_SECRET',
            'FIELD_ENCRYPTION_KEY',
            'HR_FIELD_ENCRYPTION_KEY',
            'REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY',
          ].map((name) => [name, config.get<unknown>(name)]),
        ),
      );
      try {
        for (const { id, material } of parsed.keys) this.keys.set(id, createSecretKey(material));
        this.activeId = parsed.activeId;
      } finally {
        for (const { material } of parsed.keys) material.fill(0);
      }
    } catch {
      throw new MessageEncryptionError('ENCRYPTION_UNAVAILABLE');
    }
  }

  requireEnabled(): void {
    if (!this.activeId) throw new MessageEncryptionError('ENCRYPTION_UNAVAILABLE');
  }

  active() {
    this.requireEnabled();
    return { id: this.activeId!, key: this.forDecryption(this.activeId!) };
  }

  forDecryption(id: string): KeyObject {
    this.requireEnabled();
    const key = this.keys.get(id);
    if (!key) throw new MessageEncryptionError('KEY_UNAVAILABLE');
    return key;
  }

  // Candidate check only: no removal API and no claim about live/backup references.
  assertRetirementCandidate(id: string): void {
    this.forDecryption(id);
    if (id === this.activeId) throw new MessageEncryptionError('KEY_NOT_RETIRABLE');
  }
}

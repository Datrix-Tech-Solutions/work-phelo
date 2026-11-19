import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSecretKey, KeyObject } from 'crypto';
import { parseEncryptionKeys } from '../encryption/key-ring.config';

export function parseVerificationKeys(env: Record<string, unknown>) {
  let parsed: ReturnType<typeof parseEncryptionKeys> | undefined;
  try {
    if (typeof env.AI_REQUEST_VERIFICATION_KEYS !== 'string') throw new Error();
    const entries: unknown = JSON.parse(env.AI_REQUEST_VERIFICATION_KEYS);
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 8) throw new Error();
    const first: unknown = entries[0];
    if (!first || typeof first !== 'object' || !('id' in first)) throw new Error();
    parsed = parseEncryptionKeys({
      ...env,
      AI_MESSAGE_ENCRYPTION_KEYS: env.AI_REQUEST_VERIFICATION_KEYS,
      AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: first.id,
    });
    for (const name of ['AI_MESSAGE_ENCRYPTION_KEYS', 'AI_FINGERPRINT_KEYS']) {
      const value = env[name];
      if (value === undefined) continue;
      if (typeof value !== 'string') throw new Error();
      const related: unknown = JSON.parse(value);
      if (
        !Array.isArray(related) ||
        parsed.keys.some((key) =>
          related.some(
            (other: unknown) =>
              other &&
              typeof other === 'object' &&
              'key' in other &&
              other.key === key.material.toString('base64'),
          ),
        )
      )
        throw new Error();
    }
    return parsed.keys;
  } catch {
    for (const key of parsed?.keys ?? []) key.material.fill(0);
    throw new Error('Invalid AI request verification configuration');
  }
}

@Injectable()
export class RequestVerificationKeys {
  private readonly keys = new Map<string, KeyObject>();
  constructor(private readonly config: ConfigService) {
    if (config.get<unknown>('AI_REQUEST_VERIFICATION_ENABLED') !== true) return;
    let parsed: ReturnType<typeof parseVerificationKeys> = [];
    try {
      parsed = parseVerificationKeys(
        Object.fromEntries(
          [
            'AI_REQUEST_VERIFICATION_KEYS',
            'JWT_SECRET',
            'AI_MESSAGE_ENCRYPTION_KEYS',
            'AI_FINGERPRINT_KEYS',
            'FIELD_ENCRYPTION_KEY',
            'HR_FIELD_ENCRYPTION_KEY',
            'REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY',
          ].map((name) => [name, config.get<unknown>(name)]),
        ),
      );
      for (const { id, material } of parsed) this.keys.set(id, createSecretKey(material));
    } catch {
      throw new ServiceUnavailableException();
    } finally {
      for (const key of parsed) key.material.fill(0);
    }
  }
  requireEnabled(): void {
    if (
      this.config.get<unknown>('AI_REQUEST_VERIFICATION_ENABLED') !== true ||
      !this.keys.size ||
      this.config.get<unknown>('AI_AUTHENTICATED_ROUTES_ENABLED') !== true ||
      this.config.get<unknown>('AI_PERSISTENCE_ENABLED') !== true
    )
      throw new ServiceUnavailableException();
  }
  get(id: string): KeyObject {
    this.requireEnabled();
    const key = this.keys.get(id);
    if (!key) throw new UnauthorizedException();
    return key;
  }
}

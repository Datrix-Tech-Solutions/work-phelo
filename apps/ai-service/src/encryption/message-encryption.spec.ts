import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  randomUUID,
  randomBytes,
} from 'crypto';
import { Request } from 'express';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApplication } from '../app.setup';
import { createApplication } from '../main';
import { normalizeError } from '../common/http-exception.filter';
import { parseRuntimeEnv } from '../config/runtime-env';
import { TrustedContextService } from '../auth/trusted-context.service';
import { OwnershipContext, OwnershipContextFactory } from '../persistence/ownership-context';
import { MessageEncryptionError, MessageEncryptionErrorCode } from './encryption-error';
import {
  MessageContextFactory,
  MessageEncryptionContext,
  MessageStorageMetadata,
  messageAad,
} from './message-context';
import {
  MAX_MESSAGE_BYTES,
  MessageEncryptionEnvelope,
  MessageEncryptionService,
} from './message-encryption.service';
import { MessageKeyRing } from './key-ring.service';
import { parseEncryptionKeys } from './key-ring.config';

const key = Buffer.alloc(32, 17),
  nextKey = Buffer.alloc(32, 34);
const entry = (material: Buffer) => ({
  id: createHash('sha256').update(material).digest('hex'),
  key: material.toString('base64'),
});
const old = entry(key),
  next = entry(nextKey);
const baseEnv = { NODE_ENV: 'production', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'test-v1' };
function settings(
  entries: ({ id: string; key: string } & Record<string, unknown>)[] = [old],
  active = entries[0]?.id,
) {
  return {
    AI_MESSAGE_ENCRYPTION_ENABLED: true,
    AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: active,
    AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify(entries),
  };
}
function config(values: Record<string, unknown>): ConfigService {
  return { get: (name: string) => values[name] } as ConfigService;
}
const makeRing = (values = settings()) => new MessageKeyRing(config(values));
function ownership(tenantId = 'tenant:a', id = 'owner:a') {
  return new OwnershipContextFactory({
    verifyRequest: () => ({ tenantId, id }),
  } as unknown as TrustedContextService).fromRequest({} as Request);
}
function expectCode(operation: () => unknown, code: MessageEncryptionErrorCode) {
  try {
    operation();
    throw new Error('Operation unexpectedly succeeded');
  } catch (error) {
    expect(error).toBeInstanceOf(MessageEncryptionError);
    expect(error).toMatchObject({ code });
  }
}

describe('AI authenticated message encryption', () => {
  const factory = new MessageContextFactory();
  let service: MessageEncryptionService;
  let metadata: MessageStorageMetadata;
  let context: MessageEncryptionContext;
  beforeEach(() => {
    service = new MessageEncryptionService(makeRing());
    metadata = { conversationId: randomUUID(), messageId: randomUUID(), role: 'USER', sequence: 1 };
    context = factory.forMessage(ownership(), metadata);
  });

  it.each([
    'private-plaintext-canary',
    '  unchanged \n',
    'こんにちは 🌍',
    'e\u0301',
    '\ufeffBOM retained',
    'é'.repeat(MAX_MESSAGE_BYTES / 2),
    'x'.repeat(MAX_MESSAGE_BYTES),
  ])('round-trips UTF-8 without normalization (case %#)', (plaintext) => {
    const envelope = service.encryptMessage(plaintext, context);
    expect(service.decryptMessage(envelope, context)).toBe(plaintext);
    expect(envelope.ciphertext.equals(Buffer.from(plaintext))).toBe(false);
    expect(envelope.nonce).toHaveLength(12);
    expect(envelope.authenticationTag).toHaveLength(16);
    expect(envelope.ciphertext).toHaveLength(Buffer.byteLength(plaintext));
    expect(Object.keys(envelope).sort()).toEqual([
      'authenticationTag',
      'ciphertext',
      'encryptionVersion',
      'keyId',
      'nonce',
    ]);
  });
  it.each(['', '\ud800', 'x'.repeat(MAX_MESSAGE_BYTES + 1), 'é'.repeat(MAX_MESSAGE_BYTES)])(
    'rejects empty, malformed or oversized plaintext (case %#)',
    (value) => {
      expectCode(() => service.encryptMessage(value, context), 'INVALID_PLAINTEXT');
    },
  );
  it('uses fresh random nonces, not a fixed nonce', () => {
    const nonces = new Set(
      Array.from({ length: 100 }, () =>
        service.encryptMessage('same', context).nonce.toString('hex'),
      ),
    );
    expect(nonces.size).toBe(100);
  });
  it.each(['ciphertext', 'nonce', 'authenticationTag'] as const)(
    'rejects %s tampering',
    (field) => {
      const envelope = service.encryptMessage('private-plaintext-canary', context);
      envelope[field][0] ^= 1;
      expectCode(() => service.decryptMessage(envelope, context), 'AUTHENTICATION_FAILED');
    },
  );
  it.each([
    ['tenant', 'tenant:b', 'owner:a'],
    ['owner', 'tenant:a', 'owner:b'],
  ])('authenticates %s ownership', (_name, tenant, user) => {
    const envelope = service.encryptMessage('secret', context);
    const other = factory.forMessage(ownership(tenant, user), metadata);
    expectCode(() => service.decryptMessage(envelope, other), 'AUTHENTICATION_FAILED');
  });
  it.each([
    { conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { messageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { sequence: 2 },
  ])('authenticates message metadata %p', (changes) => {
    const envelope = service.encryptMessage('secret', context);
    const other = factory.forMessage(ownership(), { ...metadata, ...changes });
    expectCode(() => service.decryptMessage(envelope, other), 'AUTHENTICATION_FAILED');
  });
  it.each([
    { role: 'ASSISTANT' },
    { role: 'USER ' },
    { sequence: 0 },
    { sequence: 2147483648 },
    { messageId: 'invalid' },
    { keyId: old.id },
  ])('rejects unsupported server metadata %p', (changes) => {
    expectCode(
      () => factory.forMessage(ownership(), { ...metadata, ...changes } as MessageStorageMetadata),
      'INVALID_CONTEXT',
    );
  });
  it('rejects forged ownership and encryption contexts', () => {
    expectCode(() => factory.forMessage({} as OwnershipContext, metadata), 'INVALID_CONTEXT');
    expectCode(
      () => service.encryptMessage('secret', {} as MessageEncryptionContext),
      'INVALID_CONTEXT',
    );
  });
  it('uses explicit versioned tuple encoding with unambiguous boundaries and immutable metadata', () => {
    expect(messageAad(context, 1, old.id).toString()).toBe(
      JSON.stringify([
        'workphelo.ai.message',
        1,
        'tenant:a',
        'owner:a',
        metadata.conversationId,
        metadata.messageId,
        'USER',
        1,
        1,
        old.id,
      ]),
    );
    const before = messageAad(context, 1, old.id);
    metadata.sequence = 999;
    expect(messageAad(context, 1, old.id)).toEqual(before);
  });
  it.each(['role', 'encryptionVersion'])(
    'cryptographically authenticates %s, beyond shape validation',
    (field) => {
      const tuple: unknown[] = JSON.parse(messageAad(context, 1, old.id).toString()) as unknown[];
      tuple[field === 'role' ? 6 : 8] = field === 'role' ? 'ASSISTANT' : 2;
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      cipher.setAAD(Buffer.from(JSON.stringify(tuple)));
      const ciphertext = Buffer.concat([cipher.update('data'), cipher.final()]);
      expectCode(
        () =>
          service.decryptMessage(
            {
              encryptionVersion: 1,
              keyId: old.id,
              ciphertext,
              nonce,
              authenticationTag: cipher.getAuthTag(),
            },
            context,
          ),
        'AUTHENTICATION_FAILED',
      );
    },
  );
  it('rejects cryptographically wrong material even if an internal provider is faulty', () => {
    const envelope = service.encryptMessage('secret', context);
    const ring = makeRing();
    const spy = jest.spyOn(ring, 'forDecryption').mockReturnValue(createSecretKey(nextKey));
    try {
      expectCode(
        () => new MessageEncryptionService(ring).decryptMessage(envelope, context),
        'AUTHENTICATION_FAILED',
      );
    } finally {
      spy.mockRestore();
    }
  });
  it.each([
    { encryptionVersion: 2 },
    { encryptionVersion: 0 },
    { keyId: 'bad' },
    { nonce: Buffer.alloc(11) },
    { authenticationTag: Buffer.alloc(15) },
    { ciphertext: Buffer.alloc(0) },
    { ciphertext: Buffer.alloc(MAX_MESSAGE_BYTES + 1) },
    { nonce: 'not-a-buffer' },
    { ciphertext: 'plaintext' },
    { plaintext: 'do not accept' },
  ])('rejects malformed envelope %p before decryption', (changes) => {
    const envelope = service.encryptMessage('secret', context);
    expectCode(
      () =>
        service.decryptMessage({ ...envelope, ...changes } as MessageEncryptionEnvelope, context),
      'INVALID_ENVELOPE',
    );
  });
  it.each(['ciphertext', 'nonce', 'authenticationTag', 'keyId', 'encryptionVersion'])(
    'requires envelope field %s',
    (field) => {
      const envelope = { ...service.encryptMessage('secret', context) };
      Reflect.deleteProperty(envelope, field);
      expectCode(() => service.decryptMessage(envelope, context), 'INVALID_ENVELOPE');
    },
  );
  it('selects exactly the configured historical key and supports active-key transition', () => {
    const encrypted = service.encryptMessage('historical', context);
    const rotated = new MessageEncryptionService(
      new MessageKeyRing(config(settings([old, next], next.id))),
    );
    expect(rotated.decryptMessage(encrypted, context)).toBe('historical');
    expect(rotated.encryptMessage('new', context).keyId).toBe(next.id);
    const retired = new MessageEncryptionService(
      new MessageKeyRing(config(settings([next], next.id))),
    );
    expectCode(() => retired.decryptMessage(encrypted, context), 'KEY_UNAVAILABLE');
    expectCode(
      () => rotated.decryptMessage({ ...encrypted, keyId: next.id }, context),
      'AUTHENTICATION_FAILED',
    );
  });
  it('rejects an unknown well-shaped key ID without trial decryption', () => {
    const envelope = service.encryptMessage('secret', context);
    expectCode(
      () => service.decryptMessage({ ...envelope, keyId: 'f'.repeat(64) }, context),
      'KEY_UNAVAILABLE',
    );
  });
  it('does not silently reload changed configuration in a running key ring', () => {
    const values = settings([old, next], old.id);
    const running = new MessageEncryptionService(new MessageKeyRing(config(values)));
    values.AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID = next.id;
    expect(running.encryptMessage('data', context).keyId).toBe(old.id);
  });
  it('provides only a retirement-candidate check, not key removal or retirement approval', () => {
    const ring = new MessageKeyRing(config(settings([old, next], next.id)));
    expectCode(() => ring.assertRetirementCandidate(next.id), 'KEY_NOT_RETIRABLE');
    expect(() => ring.assertRetirementCandidate(old.id)).not.toThrow();
    expectCode(() => ring.assertRetirementCandidate('f'.repeat(64)), 'KEY_UNAVAILABLE');
  });
  it('does not log plaintext, ciphertext, keys or low-level errors', () => {
    const spies = [
      jest.spyOn(console, 'log'),
      jest.spyOn(console, 'warn'),
      jest.spyOn(console, 'error'),
    ].map((spy) => spy.mockImplementation(() => {}));
    try {
      const envelope = service.encryptMessage('private-plaintext-canary', context);
      envelope.authenticationTag[0] ^= 1;
      try {
        service.decryptMessage(envelope, context);
      } catch (error) {
        const serialized =
          String(error) + JSON.stringify(error) + JSON.stringify(normalizeError(error));
        for (const value of [
          'private-plaintext-canary',
          old.key,
          envelope.ciphertext.toString('base64'),
        ])
          expect(serialized).not.toContain(value);
      }
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
  it('checks the native AES-256-GCM primitive against the NIST zero-key/block vector', () => {
    // Test-only known vector (no AAD). Application encryption ALWAYS generates random nonces.
    const decipher = createDecipheriv('aes-256-gcm', Buffer.alloc(32), Buffer.alloc(12), {
      authTagLength: 16,
    });
    decipher.setAuthTag(Buffer.from('d0d1c8a799996bf0265b98b5d48ab919', 'hex'));
    expect(
      Buffer.concat([
        decipher.update(Buffer.from('cea7403d4d606b6e074ec5d3baf39d18', 'hex')),
        decipher.final(),
      ]),
    ).toEqual(Buffer.alloc(16));
  });
});

describe('Encryption configuration and no public capabilities', () => {
  it('defaults off and requires no keys for foundation mode', () => {
    expect(parseRuntimeEnv(baseEnv).AI_MESSAGE_ENCRYPTION_ENABLED).toBe(false);
    const service = new MessageEncryptionService(new MessageKeyRing(config({})));
    expectCode(
      () => service.encryptMessage('data', {} as MessageEncryptionContext),
      'ENCRYPTION_UNAVAILABLE',
    );
    expectCode(
      () => service.decryptMessage({} as MessageEncryptionEnvelope, {} as MessageEncryptionContext),
      'ENCRYPTION_UNAVAILABLE',
    );
  });
  it.each([
    {},
    { AI_MESSAGE_ENCRYPTION_KEYS: 'private-config-canary' },
    settings([], old.id),
    settings([old, old]),
    settings([old], next.id),
    settings([{ ...old, key: 'short' }]),
    settings([{ ...old, key: next.key }]),
    settings([{ ...old, key: Buffer.alloc(31).toString('base64') }]),
    settings([{ ...old, key: Buffer.alloc(33).toString('base64') }]),
    settings([{ ...old, key: old.key + '\n' }]),
    settings([{ ...old, unexpected: true }]),
  ])('rejects invalid/replaced/duplicate key configuration (case %#)', (values) => {
    try {
      parseRuntimeEnv({ ...baseEnv, ...values, AI_MESSAGE_ENCRYPTION_ENABLED: 'true' });
      throw new Error('Unexpected success');
    } catch (error) {
      expect(String(error)).toMatch(
        /^RuntimeConfigurationError: Invalid or missing AI runtime configuration: AI_MESSAGE_ENCRYPTION_/,
      );
      expect(String(error)).not.toContain('private-config-canary');
      expect(String(error)).not.toContain(old.key);
    }
  });
  it.each([
    'JWT_SECRET',
    'FIELD_ENCRYPTION_KEY',
    'HR_FIELD_ENCRYPTION_KEY',
    'REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY',
  ])('rejects known reused %s without requiring other service secrets', (name) => {
    expect(() => parseEncryptionKeys({ ...settings(), [name]: key.toString('hex') })).toThrow(
      'Invalid AI message encryption configuration',
    );
  });
  it('keeps encryption independent of persistence, authentication routes and inference', () => {
    const parsed = parseRuntimeEnv({
      ...baseEnv,
      ...settings(),
      AI_MESSAGE_ENCRYPTION_ENABLED: 'true',
    });
    expect(parsed).toMatchObject({
      AI_MESSAGE_ENCRYPTION_ENABLED: true,
      AI_PERSISTENCE_ENABLED: false,
      AI_AUTHENTICATED_ROUTES_ENABLED: false,
      AI_ENABLED: false,
      AI_MOCK_ENABLED: false,
    });
  });
  it('enables no HTTP capability and leaks no configuration through probes', async () => {
    const previous = { ...process.env };
    let app: INestApplication<Server> | undefined;
    try {
      process.env = {
        ...baseEnv,
        AI_MESSAGE_ENCRYPTION_ENABLED: 'true',
        AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: old.id,
        AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([old]),
      };
      const module = await Test.createTestingModule({
        imports: [AppModule.register({ ignoreEnvFile: true })],
      }).compile();
      app = module.createNestApplication<INestApplication<Server>>({ logger: false });
      configureApplication(app, () => {});
      await app.init();
      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200, { status: 'ok', service: 'ai-service' });
      await request(app.getHttpServer())
        .get('/api/ready')
        .expect(200, { status: 'ready', service: 'ai-service', inferenceAvailable: false });
      await request(app.getHttpServer()).get('/api/eligibility').expect(503);
      for (const route of ['encrypt', 'decrypt', 'messages', 'conversations', 'generate'])
        await request(app.getHttpServer())
          .post('/api/' + route)
          .send({ content: 'private' })
          .expect(route === 'conversations' ? 503 : 404);
    } finally {
      await app?.close();
      process.env = previous;
    }
  });
  it('rejects malformed enabled configuration before application startup', async () => {
    const previous = { ...process.env };
    try {
      process.env = {
        ...baseEnv,
        AI_MESSAGE_ENCRYPTION_ENABLED: 'true',
        AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: old.id,
        AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([{ ...old, key: next.key }]),
      };
      await expect(createApplication({ ignoreEnvFile: true })).rejects.toThrow(
        'Invalid or missing AI runtime configuration: AI_MESSAGE_ENCRYPTION_KEYS',
      );
    } finally {
      process.env = previous;
    }
  });
});

import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TextDecoder } from 'util';
import { MessageKeyRing } from './key-ring.service';
import { ENCRYPTION_KEY_ID } from './key-ring.config';
import { MessageEncryptionError } from './encryption-error';
import { MessageEncryptionContext, messageAad } from './message-context';

export const MESSAGE_ENVELOPE_VERSION = 1;
export const MAX_MESSAGE_BYTES = 16 * 1024;
export interface MessageEncryptionEnvelope {
  readonly encryptionVersion: number;
  readonly keyId: string;
  readonly ciphertext: Buffer;
  readonly nonce: Buffer;
  readonly authenticationTag: Buffer;
}

@Injectable()
export class MessageEncryptionService {
  constructor(private readonly ring: MessageKeyRing) {}

  encryptMessage(plaintext: string, context: MessageEncryptionContext): MessageEncryptionEnvelope {
    this.ring.requireEnabled();
    try {
      const { id, key } = this.ring.active();
      const aad = messageAad(context, MESSAGE_ENVELOPE_VERSION, id);
      if (
        typeof plaintext !== 'string' ||
        !plaintext.length ||
        Buffer.byteLength(plaintext, 'utf8') > MAX_MESSAGE_BYTES
      ) {
        throw new MessageEncryptionError('INVALID_PLAINTEXT');
      }
      const bytes = Buffer.from(plaintext, 'utf8');
      try {
        if (bytes.toString('utf8') !== plaintext)
          throw new MessageEncryptionError('INVALID_PLAINTEXT');
        const nonce = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
        const authenticationTag = cipher.getAuthTag();
        if (
          ciphertext.length !== bytes.length ||
          nonce.length !== 12 ||
          authenticationTag.length !== 16
        )
          throw new MessageEncryptionError('ENCRYPTION_UNAVAILABLE');
        return {
          encryptionVersion: MESSAGE_ENVELOPE_VERSION,
          keyId: id,
          ciphertext,
          nonce,
          authenticationTag,
        };
      } finally {
        bytes.fill(0);
      }
    } catch (error) {
      if (error instanceof MessageEncryptionError) throw error;
      throw new MessageEncryptionError('ENCRYPTION_UNAVAILABLE');
    }
  }

  decryptMessage(envelope: MessageEncryptionEnvelope, context: MessageEncryptionContext): string {
    this.ring.requireEnabled();
    try {
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        Array.isArray(envelope) ||
        Object.keys(envelope).sort().join(',') !==
          'authenticationTag,ciphertext,encryptionVersion,keyId,nonce' ||
        envelope.encryptionVersion !== MESSAGE_ENVELOPE_VERSION ||
        typeof envelope.keyId !== 'string' ||
        !ENCRYPTION_KEY_ID.test(envelope.keyId) ||
        !Buffer.isBuffer(envelope.ciphertext) ||
        envelope.ciphertext.length < 1 ||
        envelope.ciphertext.length > MAX_MESSAGE_BYTES ||
        !Buffer.isBuffer(envelope.nonce) ||
        envelope.nonce.length !== 12 ||
        !Buffer.isBuffer(envelope.authenticationTag) ||
        envelope.authenticationTag.length !== 16
      ) {
        throw new MessageEncryptionError('INVALID_ENVELOPE');
      }
      const aad = messageAad(context, envelope.encryptionVersion, envelope.keyId);
      const key = this.ring.forDecryption(envelope.keyId);
      const decipher = createDecipheriv('aes-256-gcm', key, envelope.nonce, { authTagLength: 16 });
      decipher.setAAD(aad);
      decipher.setAuthTag(envelope.authenticationTag);
      const chunks: Buffer[] = [];
      try {
        chunks.push(decipher.update(envelope.ciphertext));
        chunks.push(decipher.final());
        const bytes = Buffer.concat(chunks);
        try {
          return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
        } finally {
          bytes.fill(0);
        }
      } finally {
        for (const chunk of chunks) chunk.fill(0);
      }
    } catch (error) {
      if (error instanceof MessageEncryptionError) throw error;
      throw new MessageEncryptionError('AUTHENTICATION_FAILED');
    }
  }
}

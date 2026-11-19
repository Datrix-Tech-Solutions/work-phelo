import { createHash, timingSafeEqual } from 'crypto';

export const ENCRYPTION_KEY_ID = /^[a-f0-9]{64}$/;
const keyEncoding = /^[A-Za-z0-9+/]{43}=$/;
export class KeyRingConfigurationError extends Error {
  constructor(
    readonly field: 'AI_MESSAGE_ENCRYPTION_KEYS' | 'AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID',
  ) {
    super('Invalid AI message encryption configuration');
  }
}

export function parseEncryptionKeys(env: Record<string, unknown>) {
  const fail = () => new KeyRingConfigurationError('AI_MESSAGE_ENCRYPTION_KEYS');
  const activeId = env.AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID;
  if (typeof activeId !== 'string' || !ENCRYPTION_KEY_ID.test(activeId)) {
    throw new KeyRingConfigurationError('AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID');
  }
  const keys: { id: string; material: Buffer }[] = [];
  try {
    if (typeof env.AI_MESSAGE_ENCRYPTION_KEYS !== 'string') throw fail();
    const entries: unknown = JSON.parse(env.AI_MESSAGE_ENCRYPTION_KEYS);
    if (!Array.isArray(entries) || entries.length === 0) throw fail();
    const ids = new Set<string>();
    for (const entry of entries as unknown[]) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        Object.keys(entry).sort().join(',') !== 'id,key'
      )
        throw fail();
      const { id, key } = entry as Record<string, unknown>;
      if (
        typeof id !== 'string' ||
        !ENCRYPTION_KEY_ID.test(id) ||
        ids.has(id) ||
        typeof key !== 'string' ||
        !keyEncoding.test(key)
      )
        throw fail();
      const material = Buffer.from(key, 'base64');
      keys.push({ id, material });
      if (
        material.length !== 32 ||
        material.toString('base64') !== key ||
        createHash('sha256').update(material).digest('hex') !== id
      )
        throw fail();
      // Reject known shared/domain key reuse without requiring those secrets in AI.
      for (const name of [
        'JWT_SECRET',
        'FIELD_ENCRYPTION_KEY',
        'HR_FIELD_ENCRYPTION_KEY',
        'REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY',
      ]) {
        const shared = env[name];
        if (typeof shared !== 'string') continue;
        const candidates = [Buffer.from(shared, 'utf8')];
        if (/^[a-f0-9]{64}$/i.test(shared)) candidates.push(Buffer.from(shared, 'hex'));
        if (keyEncoding.test(shared)) candidates.push(Buffer.from(shared, 'base64'));
        const reused = candidates.some(
          (value) => value.length === material.length && timingSafeEqual(value, material),
        );
        for (const value of candidates) value.fill(0);
        if (reused) throw fail();
      }
      ids.add(id);
    }
    if (!ids.has(activeId))
      throw new KeyRingConfigurationError('AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID');
    return { activeId, keys };
  } catch (error) {
    for (const { material } of keys) material.fill(0);
    if (error instanceof KeyRingConfigurationError) throw error;
    throw fail();
  }
}

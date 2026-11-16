import { accessFingerprint, signAccessRpc, verifyAccessRpc } from './employee-access-rpc';

describe('Employee access RPC trust', () => {
  const original = process.env.INTERNAL_SERVICE_AUTH_SECRET;
  beforeEach(() => {
    process.env.INTERNAL_SERVICE_AUTH_SECRET = 'test-only-employee-access-secret-123456789';
  });
  afterAll(() => {
    if (original === undefined) delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    else process.env.INTERNAL_SERVICE_AUTH_SECRET = original;
  });
  it('binds payload, actor, service and versioned method', () => {
    const signed = signAccessRpc('hr-service', 'execute.v1', {
      tenantId: 'tenant-1',
      actorUserId: 'actor-1',
    });
    expect(verifyAccessRpc('hr-service', 'execute.v1', signed)).toEqual(signed.payload);
    expect(() => verifyAccessRpc('auth-service', 'execute.v1', signed)).toThrow();
    expect(() => verifyAccessRpc('hr-service', 'finalize.v1', signed)).toThrow();
    expect(() =>
      verifyAccessRpc('hr-service', 'execute.v1', {
        ...signed,
        payload: { ...signed.payload, actorUserId: 'spoofed' },
      }),
    ).toThrow();
  });
  it('rejects stale and unsigned requests and missing secrets', () => {
    const signed = signAccessRpc('hr-service', 'execute.v1', {});
    expect(() =>
      verifyAccessRpc('hr-service', 'execute.v1', {
        ...signed,
        proof: { ...signed.proof, timestamp: '0' },
      }),
    ).toThrow();
    expect(() => verifyAccessRpc('hr-service', 'execute.v1', {} as never)).toThrow();
    delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    expect(() => signAccessRpc('hr-service', 'execute.v1', {})).toThrow();
    expect(() => verifyAccessRpc('hr-service', 'execute.v1', signed)).toThrow();
  });
  it('fingerprints canonical payloads without key-order dependence', () => {
    expect(accessFingerprint({ b: 2, a: 1 })).toBe(accessFingerprint({ a: 1, b: 2 }));
    expect(accessFingerprint({ a: 1 })).not.toBe(accessFingerprint({ a: 2 }));
  });
});

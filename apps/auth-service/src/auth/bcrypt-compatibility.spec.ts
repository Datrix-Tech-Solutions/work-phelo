import * as bcrypt from 'bcrypt';

describe('Real bcrypt compatibility (separate from recruiter orchestration)', () => {
  it('hashes a password and distinguishes correct and incorrect passwords', async () => {
    const password = 'synthetic-bcrypt-compatibility-fixture';
    const hash = await bcrypt.hash(password, 4);

    expect(jest.isMockFunction(bcrypt.hash)).toBe(false);
    expect(hash).not.toBe(password);
    expect(bcrypt.getRounds(hash)).toBe(4);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('incorrect-fixture', hash)).toBe(false);
  });

  // One native cost-12 hash needs a bounded budget on CPU-contended CI runners.
  it('supports the production registration work factor of 12', async () => {
    const hash = await bcrypt.hash('synthetic-cost-policy-fixture', 12);

    expect(jest.isMockFunction(bcrypt.hash)).toBe(false);
    expect(bcrypt.getRounds(hash)).toBe(12);
  }, 20000);
});

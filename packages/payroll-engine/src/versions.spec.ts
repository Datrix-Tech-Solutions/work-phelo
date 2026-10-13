import {
  diffComponents,
  latestVersion,
  sameComponents,
  versionInForce,
  versionStatus,
} from './versions';
import { component, ssnitTier1 } from './payroll.fixtures';
import type { SavedConfiguration } from './types';

const rateTwo = { ...ssnitTier1(), params: { rate: 6 } };

const config: SavedConfiguration = {
  id: 'cfg',
  name: 'Ghana',
  payslipType: 'monthly',
  currency: 'GHS',
  versions: [
    {
      version: 1,
      effectiveFrom: '2026-01-01',
      note: '',
      savedAt: '2026-01-01T00:00:00Z',
      components: [ssnitTier1()],
    },
    {
      version: 2,
      effectiveFrom: '2026-07-01',
      note: 'rate',
      savedAt: '2026-06-01T00:00:00Z',
      components: [rateTwo],
    },
    {
      version: 3,
      effectiveFrom: '2027-01-01',
      note: 'future',
      savedAt: '2026-10-01T00:00:00Z',
      components: [rateTwo],
    },
  ],
};

describe('versions', () => {
  it('picks the latest version that has started by the run date', () => {
    expect(versionInForce(config, '2026-03-01')?.version).toBe(1);
    expect(versionInForce(config, '2026-10-06')?.version).toBe(2);
    expect(versionInForce(config, '2027-02-01')?.version).toBe(3);
    expect(versionInForce(config, '2025-01-01')).toBeNull();
  });

  it('labels each version relative to today', () => {
    const labels = config.versions.map((v) => versionStatus(config, v, '2026-10-06'));
    expect(labels).toEqual(['earlier', 'in_force', 'scheduled']);
  });

  it('finds the latest version', () => {
    expect(latestVersion(config).version).toBe(3);
  });

  it('compares components regardless of key order', () => {
    const { tags, ...rest } = ssnitTier1();
    const a = ssnitTier1();
    const reordered = { tags, ...rest };
    expect(sameComponents([a], [reordered])).toBe(true);
    expect(sameComponents([a], [rateTwo])).toBe(false);
  });

  it('describes what changed', () => {
    const extra = component({ code: 'NEW', name: 'New thing', kind: 'earning', method: 'fixed' });
    expect(diffComponents([ssnitTier1()], [rateTwo])).toEqual(['Changed SSNIT Tier 1']);
    expect(diffComponents([ssnitTier1()], [ssnitTier1(), extra])).toEqual(['Added New thing']);
    expect(diffComponents([ssnitTier1(), extra], [ssnitTier1()])).toEqual(['Removed New thing']);
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { AccountingMasterDataService } from './accounting-master-data.service';

const user = { id: 'u1', tenantId: 't1' } as RequestUser;
const ID = {
  parent: '00000000-0000-4000-8000-000000000001',
  child: '00000000-0000-4000-8000-000000000002',
  pinnedParent: '00000000-0000-4000-8000-000000000003',
  usedChild: '00000000-0000-4000-8000-000000000004',
  gone: '00000000-0000-4000-8000-000000000005',
};

const account = (id: string, code: string, parentAccountId: string | null) => ({
  id,
  code,
  name: code,
  category: 'ASSET',
  parentAccountId,
  classification: null,
  accountGroup: null,
});

describe('AccountingMasterDataService unused GL accounts', () => {
  const findMany = jest.fn();
  let service: AccountingMasterDataService;

  beforeEach(() => {
    findMany.mockReset();
    // 1st call: accounts nothing references. 2nd call: every parent/child link.
    findMany
      .mockResolvedValueOnce([
        account(ID.parent, '1100', null),
        account(ID.child, '1110', ID.parent),
        account(ID.pinnedParent, '1200', null),
      ])
      .mockResolvedValueOnce([
        { id: ID.child, parentAccountId: ID.parent },
        { id: ID.usedChild, parentAccountId: ID.pinnedParent },
      ]);
    service = new AccountingMasterDataService({
      gLAccount: { findMany },
    } as never);
  });

  it('lists an unused branch but not a parent pinned by a used child', async () => {
    const unused = await service.listUnusedGLAccounts('t1');
    expect(unused.map((a) => a.id)).toEqual([ID.parent, ID.child]);
  });

  it('deletes children before parents and skips accounts that are no longer unused', async () => {
    const remove = jest
      .spyOn(service, 'deleteGLAccount')
      .mockResolvedValue({ id: 'x' });

    const { results } = await service.bulkDeleteGLAccounts(user, {
      accountIds: [ID.parent, ID.child, ID.gone],
    });

    expect(remove.mock.calls.map(([, id]) => id)).toEqual([
      ID.child,
      ID.parent,
    ]);
    expect(results.find((r) => r.id === ID.gone)).toMatchObject({
      status: 'skipped',
    });
    expect(results.filter((r) => r.status === 'deleted')).toHaveLength(2);
  });

  it('reports a delete the server refuses as failed without stopping the rest', async () => {
    jest
      .spyOn(service, 'deleteGLAccount')
      .mockRejectedValueOnce(new ConflictException('referenced elsewhere'))
      .mockResolvedValueOnce({ id: 'x' });

    const { results } = await service.bulkDeleteGLAccounts(user, {
      accountIds: [ID.parent, ID.child],
    });

    expect(results.find((r) => r.id === ID.child)).toMatchObject({
      status: 'failed',
      message: 'referenced elsewhere',
    });
    expect(results.find((r) => r.id === ID.parent)?.status).toBe('deleted');
  });
});

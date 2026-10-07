import { ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { RecordStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';

const user = { id: 'u1', tenantId: 't1' } as RequestUser;

const inactiveAccount: {
  id: string;
  tenantId: string;
  status: RecordStatus;
  allowPosting: boolean;
  classificationId: string;
  accountGroupId: string;
  parentAccountId: string | null;
} = {
  id: 'acc-1',
  tenantId: 't1',
  status: RecordStatus.INACTIVE,
  allowPosting: false,
  classificationId: 'cls-1',
  accountGroupId: 'grp-1',
  parentAccountId: null,
};

function setup(
  options: {
    account?: Partial<typeof inactiveAccount>;
    classificationActive?: boolean;
    groupActive?: boolean;
    parentStatus?: RecordStatus;
    childCount?: number;
  } = {},
) {
  const account = { ...inactiveAccount, ...options.account };
  const update = jest
    .fn<Promise<unknown>, [{ data: Record<string, unknown> }]>()
    .mockImplementation(({ data }) => Promise.resolve({ ...account, ...data }));
  const findAccount = jest
    .fn()
    .mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === account.id
          ? account
          : {
              status: options.parentStatus ?? RecordStatus.ACTIVE,
              name: 'Parent',
            },
      ),
    );
  const prisma = {
    gLAccount: {
      findFirst: findAccount,
      update,
      count: jest.fn().mockResolvedValue(options.childCount ?? 0),
    },
    accountClassification: {
      findFirst: jest.fn().mockResolvedValue({
        isActive: options.classificationActive ?? true,
        name: 'Current Assets',
      }),
    },
    accountGroup: {
      findFirst: jest.fn().mockResolvedValue({
        isActive: options.groupActive ?? true,
        name: 'Bank Accounts',
      }),
    },
    accountingAuditLog: { create: jest.fn() },
  } as unknown as PrismaService;
  return { service: new AccountingMasterDataService(prisma), update };
}

describe('AccountingMasterDataService.activateGLAccount', () => {
  it('reactivates the account and switches posting back on', async () => {
    const { service, update } = setup();
    await service.activateGLAccount(user, 'acc-1');
    expect(update.mock.calls[0][0].data).toMatchObject({
      status: RecordStatus.ACTIVE,
      allowPosting: true,
    });
  });

  it('keeps posting off for a summary account that has child accounts', async () => {
    const { service, update } = setup({ childCount: 3 });
    await service.activateGLAccount(user, 'acc-1');
    expect(update.mock.calls[0][0].data.allowPosting).toBe(false);
  });

  it('does nothing to an account that is already active', async () => {
    const { service, update } = setup({
      account: { status: RecordStatus.ACTIVE },
    });
    await service.activateGLAccount(user, 'acc-1');
    expect(update).not.toHaveBeenCalled();
  });

  it('will not come back under an inactive classification', async () => {
    const { service, update } = setup({ classificationActive: false });
    await expect(service.activateGLAccount(user, 'acc-1')).rejects.toThrow(
      'Reactivate the classification',
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('will not come back under an inactive parent account', async () => {
    const { service } = setup({ groupActive: false });
    await expect(
      service.activateGLAccount(user, 'acc-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('will not come back under an inactive parent GL account', async () => {
    const { service } = setup({
      account: { parentAccountId: 'acc-parent' },
      parentStatus: RecordStatus.INACTIVE,
    });
    await expect(service.activateGLAccount(user, 'acc-1')).rejects.toThrow(
      'Reactivate the account',
    );
  });
});

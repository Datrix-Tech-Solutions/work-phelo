import { RequestUser } from '@work-phelo/types';
import { GLAccountCategory } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';

const user = { id: 'u1', tenantId: 't1' } as RequestUser;

const classification = {
  id: 'cls-1',
  tenantId: 't1',
  code: '1000',
  name: 'Current Assets',
  category: GLAccountCategory.ASSET,
  isActive: true,
};

type CreateArgs = [{ data: Record<string, unknown> }];

function setup() {
  const echo = ({ data }: CreateArgs[0]) =>
    Promise.resolve({ id: 'new-1', ...data, classification });
  const classificationCreate = jest
    .fn<Promise<unknown>, CreateArgs>()
    .mockImplementation(echo);
  const classificationUpdate = jest
    .fn<Promise<unknown>, CreateArgs>()
    .mockImplementation(echo);
  const groupCreate = jest
    .fn<Promise<unknown>, CreateArgs>()
    .mockImplementation(echo);
  const groupUpdate = jest
    .fn<Promise<unknown>, CreateArgs>()
    .mockImplementation(echo);
  const prisma = {
    accountClassification: {
      create: classificationCreate,
      update: classificationUpdate,
      findFirst: jest.fn().mockResolvedValue(classification),
    },
    accountGroup: {
      create: groupCreate,
      update: groupUpdate,
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'grp-1', code: '1100', classification }),
    },
    accountingAuditLog: { create: jest.fn() },
  } as unknown as PrismaService;
  return {
    service: new AccountingMasterDataService(prisma),
    classificationCreate,
    classificationUpdate,
    groupCreate,
    groupUpdate,
  };
}

describe('classification and parent account descriptions', () => {
  it('stores a classification description, trimmed', async () => {
    const { service, classificationCreate } = setup();
    await service.createAccountClassification(user, {
      code: '1000',
      name: 'Current Assets',
      category: GLAccountCategory.ASSET,
      description: '  Cash and receivables ',
    });
    expect(classificationCreate.mock.calls[0][0].data.description).toBe(
      'Cash and receivables',
    );
  });

  it('leaves it empty when none is given', async () => {
    const { service, classificationCreate } = setup();
    await service.createAccountClassification(user, {
      code: '1000',
      name: 'Current Assets',
      category: GLAccountCategory.ASSET,
    });
    expect(classificationCreate.mock.calls[0][0].data.description).toBe(
      undefined,
    );
  });

  it('changes a classification description only when one is sent, and can clear it', async () => {
    const { service, classificationUpdate } = setup();
    await service.updateAccountClassification(user, 'cls-1', { name: 'X' });
    expect(classificationUpdate.mock.calls[0][0].data).not.toHaveProperty(
      'description',
    );
    await service.updateAccountClassification(user, 'cls-1', {
      description: '',
    });
    expect(classificationUpdate.mock.calls[1][0].data.description).toBeNull();
  });

  it('stores a parent account description', async () => {
    const { service, groupCreate } = setup();
    await service.createAccountGroup(user, {
      classificationId: 'cls-1',
      code: '1100',
      name: 'Bank Accounts',
      description: 'All our banks',
    });
    expect(groupCreate.mock.calls[0][0].data.description).toBe('All our banks');
  });

  it('changes a parent account description when one is sent', async () => {
    const { service, groupUpdate } = setup();
    await service.updateAccountGroup(user, 'grp-1', {
      description: 'Updated',
    });
    expect(groupUpdate.mock.calls[0][0].data.description).toBe('Updated');
  });
});

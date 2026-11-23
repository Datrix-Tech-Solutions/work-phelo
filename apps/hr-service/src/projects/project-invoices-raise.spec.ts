import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { ProjectAccountingClient } from './billing/project-accounting.client';
import { ProjectAccountingEvent } from './dto/project-accounting-event.dto';
import { ProjectInvoicesService } from './project-invoices.service';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

const user = { id: 'user-1', tenantId: 'tenant-1' } as unknown as RequestUser;
const SUBMISSION = '11111111-1111-4111-8111-111111111111';
const ENTITY_TYPE = '22222222-2222-4222-8222-222222222222';
const TXN_TYPE = '33333333-3333-4333-8333-333333333333';

const dto = (over: Record<string, unknown> = {}) => ({
  submissionId: SUBMISSION,
  entityTypeId: ENTITY_TYPE,
  transactionTypeId: TXN_TYPE,
  amount: 150,
  description: 'Website: Design',
  lines: [
    { key: 'a', label: 'Design', amount: 100 },
    { key: 'b', label: 'Build', amount: 50 },
  ],
  ...over,
});

function setup(
  project: Record<string, unknown> | null,
  client: Record<string, unknown> | null = {
    id: 'client-1',
    name: 'Dell',
    accountingEntityId: null,
    accountingEntityTypeId: null,
  },
  canManage = true,
) {
  const prisma = {
    project: { findFirst: jest.fn().mockResolvedValue(project) },
    projectClient: {
      findFirst: jest.fn().mockResolvedValue(client),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    projectInvoice: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...data, createdAt: new Date('2026-11-23') }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const accounting = {
    isConfigured: jest.fn().mockReturnValue(true),
    createTransaction: jest.fn().mockResolvedValue({
      entityId: 'entity-1',
      entityTypeId: ENTITY_TYPE,
      transactionId: 'txn-1',
      state: 'DRAFT',
    }),
    getOptions: jest.fn(),
  };
  const projects = {
    getWorkAccess: jest.fn().mockResolvedValue({ canManage }),
  };
  const service = new ProjectInvoicesService(
    prisma as unknown as PrismaService,
    projects as unknown as ProjectsService,
    accounting as unknown as ProjectAccountingClient,
  );
  return { service, prisma, accounting };
}

const billable = {
  clientId: 'client-1',
  billable: true,
  clientSource: 'PROJECT',
};

describe('ProjectInvoicesService raising to a project client', () => {
  it('sends the invoice to Accounting and keeps the entity it made', async () => {
    const { service, prisma, accounting } = setup(billable);
    const result = await service.raise('tenant-1', 'p1', user, dto());

    expect(accounting.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `project-invoice:client-1:${SUBMISSION}`,
        externalRef: 'client-1',
        entityName: 'Dell',
        entityTypeId: ENTITY_TYPE,
        amount: 150,
      }),
      'user-1',
    );
    expect(prisma.projectClient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          accountingEntityId: 'entity-1',
          accountingEntityTypeId: ENTITY_TYPE,
        },
      }),
    );
    expect(result).toMatchObject({ transactionId: 'txn-1', state: 'DRAFT' });
  });

  it('reuses the entity on a later invoice', async () => {
    const { service, accounting, prisma } = setup(billable, {
      id: 'client-1',
      name: 'Dell',
      accountingEntityId: 'entity-1',
      accountingEntityTypeId: ENTITY_TYPE,
    });
    await service.raise(
      'tenant-1',
      'p1',
      user,
      dto({ entityTypeId: undefined }),
    );

    const sent = accounting.createTransaction.mock.calls[0][0];
    expect(sent.entityId).toBe('entity-1');
    expect(sent.entityTypeId).toBeUndefined();
    expect(prisma.projectClient.updateMany).not.toHaveBeenCalled();
  });

  it('returns an invoice already raised instead of raising it again', async () => {
    const { service, prisma, accounting } = setup(billable);
    prisma.projectInvoice.findFirst.mockResolvedValue({
      id: SUBMISSION,
      transactionId: 'txn-1',
      amount: 150,
      createdAt: new Date('2026-11-23'),
    });
    await service.raise('tenant-1', 'p1', user, dto());
    expect(accounting.createTransaction).not.toHaveBeenCalled();
  });

  it('refuses a marketing client: those go through marketing', async () => {
    const { service, accounting } = setup({ ...billable, clientSource: null });
    await expect(
      service.raise('tenant-1', 'p1', user, dto()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.createTransaction).not.toHaveBeenCalled();
  });

  it('refuses a project that is not billable', async () => {
    const { service } = setup({ ...billable, billable: false });
    await expect(
      service.raise('tenant-1', 'p1', user, dto()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an amount that is not the total of the lines', async () => {
    const { service, accounting } = setup(billable);
    await expect(
      service.raise('tenant-1', 'p1', user, dto({ amount: 151 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accounting.createTransaction).not.toHaveBeenCalled();
  });

  it('needs an entity type for the first invoice', async () => {
    const { service } = setup(billable);
    await expect(
      service.raise('tenant-1', 'p1', user, dto({ entityTypeId: undefined })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is for people who can manage the project', async () => {
    const { service } = setup(billable, undefined, false);
    await expect(
      service.raise('tenant-1', 'p1', user, dto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ProjectInvoicesService hearing from Accounting', () => {
  const event = (over: Record<string, unknown> = {}) => ({
    tenantId: 'tenant-1',
    sourceModule: 'PROJECTS',
    transactionId: 'txn-1',
    event: ProjectAccountingEvent.POSTED,
    ...over,
  });

  it('records what happened to the invoice', async () => {
    const { service, prisma } = setup(billable);
    const result = await service.handleAccountingEvent(event());
    expect(prisma.projectInvoice.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', transactionId: 'txn-1' },
      data: { state: 'POSTED' },
    });
    expect(result).toEqual({ handled: true });
  });

  it('says handled: false for a transaction it did not raise', async () => {
    const { service, prisma } = setup(billable);
    prisma.projectInvoice.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.handleAccountingEvent(event())).toEqual({
      handled: false,
    });
  });

  it('ignores events for other sources', async () => {
    const { service, prisma } = setup(billable);
    const result = await service.handleAccountingEvent(
      event({ sourceModule: 'MARKETING' }),
    );
    expect(result).toEqual({ handled: false });
    expect(prisma.projectInvoice.updateMany).not.toHaveBeenCalled();
  });
});

import { InventoryService } from './inventory.service';
import { PrismaService } from './prisma/prisma.service';

// No database: stand-in clients record what the service sends to Prisma.
describe('InventoryService - purchase order approval', () => {
  const setup = (status: string, receivedQuantity = '0') => {
    const update = jest.fn().mockResolvedValue({ id: 'po-1', lines: [] });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      purchaseOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'po-1',
          status,
          lines: [
            {
              receivedQuantity: { gt: () => receivedQuantity !== '0' },
              extraQuantity: { gt: () => false },
            },
          ],
        }),
        update,
      },
    };
    const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
    return { service: new InventoryService(prisma as unknown as PrismaService), update };
  };

  it('approves a pending order and records who approved it', async () => {
    const { service, update } = setup('PENDING_APPROVAL');
    await service.approvePurchaseOrder('t1', 'user-9', 'po-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ORDERED', approvedBy: 'user-9' }) as unknown,
      }),
    );
  });

  it('only approves or rejects an order that is waiting', async () => {
    for (const status of ['ORDERED', 'REJECTED', 'CANCELLED']) {
      const { service, update } = setup(status);
      await expect(service.approvePurchaseOrder('t1', 'u', 'po-1')).rejects.toThrow(
        'waiting for approval',
      );
      await expect(service.rejectPurchaseOrder('t1', 'u', 'po-1', 'No')).rejects.toThrow(
        'waiting for approval',
      );
      expect(update).not.toHaveBeenCalled();
    }
  });

  it('rejects with a reason and who rejected it', async () => {
    const { service, update } = setup('PENDING_APPROVAL');
    await service.rejectPurchaseOrder('t1', 'user-9', 'po-1', 'Too expensive');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectedBy: 'user-9',
          rejectionReason: 'Too expensive',
        }) as unknown,
      }),
    );
  });

  it('will not receive or close an order that is not approved', async () => {
    for (const status of ['PENDING_APPROVAL', 'REJECTED']) {
      const { service } = setup(status);
      await expect(
        service.receivePurchaseOrder('t1', 'u', 'po-1', { dateReceived: '2026-11-12', lines: [] }),
      ).rejects.toThrow();
      await expect(service.closePurchaseOrder('t1', 'po-1')).rejects.toThrow('not been approved');
    }
  });

  it('can cancel an order that is waiting for approval', async () => {
    const { service, update } = setup('PENDING_APPROVAL');
    await service.cancelPurchaseOrder('t1', 'po-1');
    expect(update).toHaveBeenCalled();
  });
});

describe('InventoryService - stock movement approval', () => {
  const request = (status = 'PENDING') => ({
    id: 'req-1',
    kind: 'STOCK_IN',
    status,
    createdBy: 'creator-1',
    payload: { locationId: 'loc-1', dateReceived: '2026-11-12', lines: [] },
  });

  it('saves a request without touching stock', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'req-1' });
    const prisma = { stockMovementRequest: { create } };
    const service = new InventoryService(prisma as unknown as PrismaService);
    await service.submitMovementRequest('t1', 'user-1', 'STOCK_IN', {
      locationId: 'loc-1',
      dateReceived: '2026-11-12',
      reference: ' SIN-1 ',
      lines: [],
    } as never);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 't1',
        kind: 'STOCK_IN',
        reference: 'SIN-1',
        createdBy: 'user-1',
      }) as unknown,
    });
  });

  it('refuses to approve a request that is not pending', async () => {
    const prisma = {
      stockMovementRequest: { findFirst: jest.fn().mockResolvedValue(request('REJECTED')) },
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    await expect(service.approveMovementRequest('t1', 'u2', 'req-1')).rejects.toThrow(
      'waiting for approval',
    );
  });

  it('posts as the creator and stamps the approver, in the same transaction', async () => {
    const updateRequests = jest.fn().mockResolvedValue({ count: 1 });
    const updateMovements = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      stockMovementRequest: { updateMany: updateRequests },
      stockMovement: { updateMany: updateMovements },
    };
    const prisma = {
      stockMovementRequest: { findFirst: jest.fn().mockResolvedValue(request()) },
      // An empty request has no lines, so the batch only runs the "after" step.
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    const result = await service.approveMovementRequest('t1', 'approver-2', 'req-1');
    expect(updateRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', decidedBy: 'approver-2' }) as unknown,
      }),
    );
    expect(updateMovements).toHaveBeenCalledWith(
      expect.objectContaining({ data: { approvedBy: 'approver-2' } }),
    );
    expect(result.batchId).toEqual(expect.any(String));
  });

  it('fails the whole approval when another approver got there first', async () => {
    const tx = {
      stockMovementRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      stockMovement: { updateMany: jest.fn() },
    };
    const prisma = {
      stockMovementRequest: { findFirst: jest.fn().mockResolvedValue(request()) },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    await expect(service.approveMovementRequest('t1', 'u2', 'req-1')).rejects.toThrow(
      'already been approved or rejected',
    );
    expect(tx.stockMovement.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a pending request with a reason', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      stockMovementRequest: {
        updateMany,
        findFirst: jest.fn().mockResolvedValue({ ...request('REJECTED') }),
      },
    };
    const service = new InventoryService(prisma as unknown as PrismaService);
    await service.rejectMovementRequest('t1', 'u2', 'req-1', 'Wrong warehouse');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Wrong warehouse',
        }) as unknown,
      }),
    );
  });
});

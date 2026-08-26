import { RequestUser } from '@work-phelo/types';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';
import { PlacementPermission } from '../placement.permissions';
import { ReinsurancePaymentsWorklistService } from './payments-worklist.service';
import { ReinsuranceWorklistsController } from './reinsurance-worklists.controller';

describe('ReinsuranceWorklistsController', () => {
  const paymentsWorklist = {
    findPayments: jest.fn(),
  };
  const user = { tenantId: 'tenant-1' } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new ReinsuranceWorklistsController(
      paymentsWorklist as unknown as ReinsurancePaymentsWorklistService,
    );

  it('delegates payment worklist queries using only authenticated tenant context', async () => {
    const controller = createController();
    const query = {
      page: 1,
      limit: 10,
      search: 'FAC',
      status: 'Paid',
    } as const;
    paymentsWorklist.findPayments.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    await controller.findPayments(query, { user } as never);

    expect(paymentsWorklist.findPayments).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
  });

  it('requires placement view permission for the payments worklist', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      ReinsuranceWorklistsController.prototype,
      'findPayments',
    );

    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        descriptor?.value as (...args: unknown[]) => unknown,
      ),
    ).toEqual([PlacementPermission.VIEW]);
  });
});

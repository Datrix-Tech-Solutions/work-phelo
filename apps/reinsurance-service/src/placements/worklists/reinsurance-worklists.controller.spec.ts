import { RequestUser } from '@work-phelo/types';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';
import { PlacementPermission } from '../placement.permissions';
import { ReinsuranceClaimRowStateService } from './claim-row-state.service';
import { ReinsuranceFacultativeRowStateService } from './facultative-row-state.service';
import { ReinsurancePaymentsWorklistService } from './payments-worklist.service';
import { ReinsuranceWorklistsController } from './reinsurance-worklists.controller';

describe('ReinsuranceWorklistsController', () => {
  const paymentsWorklist = {
    findPayments: jest.fn(),
  };
  const facultativeRowState = {
    findRowState: jest.fn(),
  };
  const claimRowState = {
    findRowState: jest.fn(),
  };
  const user = { tenantId: 'tenant-1' } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new ReinsuranceWorklistsController(
      paymentsWorklist as unknown as ReinsurancePaymentsWorklistService,
      facultativeRowState as unknown as ReinsuranceFacultativeRowStateService,
      claimRowState as unknown as ReinsuranceClaimRowStateService,
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

  it('delegates facultative row-state queries using only authenticated tenant context', async () => {
    const controller = createController();
    const query = {
      placementIds: ['11111111-1111-4111-8111-111111111111'],
    };
    facultativeRowState.findRowState.mockResolvedValue({ items: [] });

    await controller.findFacultativeRowState(query, { user } as never);

    expect(facultativeRowState.findRowState).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
  });

  it('requires placement view permission for the facultative row-state worklist', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      ReinsuranceWorklistsController.prototype,
      'findFacultativeRowState',
    );

    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        descriptor?.value as (...args: unknown[]) => unknown,
      ),
    ).toEqual([PlacementPermission.VIEW]);
  });

  it('delegates claim row-state queries using only authenticated tenant context', async () => {
    const controller = createController();
    const query = {
      claimIds: ['11111111-1111-4111-8111-111111111111'],
    };
    claimRowState.findRowState.mockResolvedValue({ items: [] });

    await controller.findClaimRowState(query, { user } as never);

    expect(claimRowState.findRowState).toHaveBeenCalledWith('tenant-1', query);
  });

  it('requires placement view permission for the claim row-state worklist', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      ReinsuranceWorklistsController.prototype,
      'findClaimRowState',
    );

    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        descriptor?.value as (...args: unknown[]) => unknown,
      ),
    ).toEqual([PlacementPermission.VIEW]);
  });
});

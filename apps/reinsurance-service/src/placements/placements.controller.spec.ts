import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
} from '../../prisma/generated/client';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PlacementPermission } from './placement.permissions';
import { PlacementClosingsService } from './placement-closings.service';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';

describe('PlacementsController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    getLockStatus: jest.fn(),
    getOfferSlipPreview: jest.fn(),
    getClosingSlipPreview: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    addParticipant: jest.fn(),
    updateParticipant: jest.fn(),
    changeParticipantStatus: jest.fn(),
    deleteParticipant: jest.fn(),
    archive: jest.fn(),
  };
  const closingsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    changeStatus: jest.fn(),
  };
  const user = {
    tenantId: 'tenant-1',
  } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = () =>
    new PlacementsController(
      service as unknown as PlacementsService,
      closingsService as unknown as PlacementClosingsService,
    );

  it('delegates list queries using only the authenticated tenant context', async () => {
    const controller = createController();
    const query = { page: 1, limit: 20 };

    await controller.findAll(query, { user } as never);

    expect(service.findAll).toHaveBeenCalledWith('tenant-1', query);
  });

  it.each([
    ['findAll', PlacementPermission.VIEW],
    ['findOne', PlacementPermission.VIEW],
    ['getLockStatus', PlacementPermission.VIEW],
    ['getOfferSlipPreview', PlacementPermission.VIEW],
    ['getClosingSlipPreview', PlacementPermission.VIEW],
    ['findClosings', PlacementPermission.VIEW],
    ['findClosing', PlacementPermission.VIEW],
    ['create', PlacementPermission.CREATE],
    ['update', PlacementPermission.EDIT],
    ['changeStatus', PlacementPermission.EDIT],
    ['addParticipant', PlacementPermission.EDIT],
    ['updateParticipant', PlacementPermission.EDIT],
    ['changeParticipantStatus', PlacementPermission.EDIT],
    ['deleteParticipant', PlacementPermission.EDIT],
    ['createClosing', PlacementPermission.EDIT],
    ['changeClosingStatus', PlacementPermission.EDIT],
    ['archive', PlacementPermission.DELETE],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PlacementsController.prototype[method as keyof PlacementsController],
      ),
    ).toEqual([permission]);
  });

  it('delegates participant mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.addParticipant(
      'placement-1',
      {
        counterpartyId: 'reinsurer-1',
        role: PlacementParticipantRole.REINSURER,
      },
      { user } as never,
    );
    await controller.updateParticipant(
      'placement-1',
      'participant-1',
      { sharePercent: 25 },
      { user } as never,
    );
    await controller.changeParticipantStatus(
      'placement-1',
      'participant-1',
      { status: PlacementParticipantStatus.OFFER_SENT },
      { user } as never,
    );
    await controller.deleteParticipant('placement-1', 'participant-1', {
      user,
    } as never);

    expect(service.addParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      expect.objectContaining({ counterpartyId: 'reinsurer-1' }),
    );
    expect(service.updateParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
      expect.objectContaining({ sharePercent: 25 }),
    );
    expect(service.changeParticipantStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
      expect.objectContaining({ status: 'OFFER_SENT' }),
    );
    expect(service.deleteParticipant).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
  });

  it('delegates slip preview reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getOfferSlipPreview('placement-1', { user } as never);
    await controller.getClosingSlipPreview('placement-1', 'participant-1', {
      user,
    } as never);

    expect(service.getOfferSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(service.getClosingSlipPreview).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'participant-1',
    );
  });

  it('delegates lock status reads with authenticated tenant context', async () => {
    const controller = createController();

    await controller.getLockStatus('placement-1', { user } as never);

    expect(service.getLockStatus).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
  });

  it('delegates closing reads with authenticated tenant context', async () => {
    const controller = createController();
    closingsService.findAll.mockResolvedValue([]);

    const listResult = await controller.findClosings('placement-1', {
      user,
    } as never);
    await controller.findClosing('placement-1', 'closing-1', {
      user,
    } as never);

    expect(closingsService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
    );
    expect(listResult).toEqual({ items: [] });
    expect(closingsService.findOne).toHaveBeenCalledWith(
      'tenant-1',
      'placement-1',
      'closing-1',
    );
  });

  it('delegates closing mutations with authenticated user context', async () => {
    const controller = createController();

    await controller.createClosing('placement-1', 'participant-1', {
      user,
    } as never);
    await controller.changeClosingStatus(
      'placement-1',
      'closing-1',
      { status: PlacementClosingStatus.ISSUED },
      { user } as never,
    );

    expect(closingsService.create).toHaveBeenCalledWith(
      user,
      'placement-1',
      'participant-1',
    );
    expect(closingsService.changeStatus).toHaveBeenCalledWith(
      user,
      'placement-1',
      'closing-1',
      expect.objectContaining({ status: PlacementClosingStatus.ISSUED }),
    );
  });
});

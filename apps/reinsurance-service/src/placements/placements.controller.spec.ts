import { RequestUser } from '@work-phelo/types';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PlacementPermission } from './placement.permissions';
import { PlacementsController } from './placements.controller';
import { PlacementsService } from './placements.service';

describe('PlacementsController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    archive: jest.fn(),
  };
  const user = {
    tenantId: 'tenant-1',
  } as RequestUser;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates list queries using only the authenticated tenant context', async () => {
    const controller = new PlacementsController(
      service as unknown as PlacementsService,
    );
    const query = { page: 1, limit: 20 };

    await controller.findAll(query, { user } as never);

    expect(service.findAll).toHaveBeenCalledWith('tenant-1', query);
  });

  it.each([
    ['findAll', PlacementPermission.VIEW],
    ['findOne', PlacementPermission.VIEW],
    ['create', PlacementPermission.CREATE],
    ['update', PlacementPermission.EDIT],
    ['changeStatus', PlacementPermission.EDIT],
    ['archive', PlacementPermission.DELETE],
  ])('requires %s permission on %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PlacementsController.prototype[method as keyof PlacementsController],
      ),
    ).toEqual([permission]);
  });
});

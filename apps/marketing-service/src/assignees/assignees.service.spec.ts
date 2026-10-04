/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { AuthDirectoryClient } from '../appointments/auth-directory.client';
import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { AuthUsersClient } from './auth-users.client';
import { AssigneesController } from './assignees.controller';
import { AssigneesService } from './assignees.service';

describe('AssigneesService', () => {
  const user: RequestUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'a@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ada',
    moduleConfig: {},
    featureConfig: {},
    integrationConfig: {},
    permissions: [],
  };
  const withPermissions = (...permissions: string[]): RequestUser => ({
    ...user,
    permissions,
  });
  const moduleUser = (id: string, first: string, status = 'ACTIVE') => ({
    id,
    firstName: first,
    lastName: 'Mensah',
    email: `${first}@example.com`,
    status,
  });

  let auth: { moduleUsers: jest.Mock };
  let users: { names: jest.Mock };
  let service: AssigneesService;

  beforeEach(() => {
    auth = {
      moduleUsers: jest
        .fn()
        .mockResolvedValue([
          moduleUser('user-2', 'Kofi'),
          moduleUser('user-3', 'Ama'),
          moduleUser('user-4', 'Yaw', 'INACTIVE'),
        ]),
    };
    users = { names: jest.fn().mockResolvedValue([]) };
    service = new AssigneesService(
      auth as unknown as AuthDirectoryClient,
      users as unknown as AuthUsersClient,
    );
  });

  describe('forCreate', () => {
    it('assigns the creator when nobody else is chosen', async () => {
      await expect(service.forCreate(user, 'prospect')).resolves.toBe('user-1');
      expect(auth.moduleUsers).not.toHaveBeenCalled();
    });

    it('lets anyone choose themselves without the permission', async () => {
      await expect(service.forCreate(user, 'client', 'user-1')).resolves.toBe(
        'user-1',
      );
    });

    it('refuses someone else without the permission, and checks nothing', async () => {
      await expect(
        service.forCreate(user, 'prospect', 'user-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auth.moduleUsers).not.toHaveBeenCalled();
    });

    it('does not let the prospect permission assign clients', async () => {
      await expect(
        service.forCreate(
          withPermissions(P.PROSPECTS_ASSIGN),
          'client',
          'user-2',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets a user with the permission pick a Marketing user', async () => {
      await expect(
        service.forCreate(
          withPermissions(P.PROSPECTS_ASSIGN),
          'prospect',
          'user-2',
        ),
      ).resolves.toBe('user-2');
    });

    it('lets tenant admins assign without the permission', async () => {
      await expect(
        service.forCreate(
          { ...user, role: 'TENANT_ADMIN' },
          'client',
          'user-2',
        ),
      ).resolves.toBe('user-2');
    });

    it('refuses someone who does not use the Marketing module', async () => {
      await expect(
        service.forCreate(
          withPermissions(P.CLIENTS_ASSIGN),
          'client',
          'outsider',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses an inactive Marketing user', async () => {
      await expect(
        service.forCreate(
          withPermissions(P.CLIENTS_ASSIGN),
          'client',
          'user-4',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('says so when the user directory cannot be reached', async () => {
      auth.moduleUsers.mockRejectedValue(new Error('down'));

      await expect(
        service.forCreate(
          withPermissions(P.CLIENTS_ASSIGN),
          'client',
          'user-2',
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('forUpdate', () => {
    it('changes nothing when no one, or the current assignee, is given', async () => {
      await expect(
        service.forUpdate(user, 'prospect', 'user-1', undefined),
      ).resolves.toBeNull();
      await expect(
        service.forUpdate(user, 'prospect', 'user-1', 'user-1'),
      ).resolves.toBeNull();
      expect(auth.moduleUsers).not.toHaveBeenCalled();
    });

    it('refuses a reassignment without the permission', async () => {
      await expect(
        service.forUpdate(user, 'client', 'user-1', 'user-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the new assignee for a user with the permission', async () => {
      await expect(
        service.forUpdate(
          withPermissions(P.CLIENTS_ASSIGN),
          'client',
          'user-1',
          'user-2',
        ),
      ).resolves.toBe('user-2');
    });
  });

  describe('names', () => {
    it('names users from the user directory in one call, whatever permissions they hold', async () => {
      users.names.mockResolvedValue([
        { id: 'user-2', firstName: 'Kofi', lastName: 'Mensah' },
        { id: 'admin-1', firstName: 'Esi', lastName: 'Admin' },
      ]);

      const names = await service.namesFor('tenant-1', [
        'user-2',
        'admin-1',
        'user-2',
      ]);

      expect(names.get('user-2')).toBe('Kofi Mensah');
      expect(names.get('admin-1')).toBe('Esi Admin');
      expect(users.names).toHaveBeenCalledTimes(1);
      expect(users.names).toHaveBeenCalledWith('tenant-1', [
        'user-2',
        'admin-1',
      ]);
    });

    it('does not ask when there is no one to name', async () => {
      await expect(service.namesFor('tenant-1', [])).resolves.toEqual(
        new Map(),
      );
      expect(users.names).not.toHaveBeenCalled();
    });

    it('names a single user', async () => {
      users.names.mockResolvedValue([
        { id: 'user-2', firstName: 'Kofi', lastName: 'Mensah' },
      ]);

      await expect(service.nameFor('tenant-1', 'user-2')).resolves.toBe(
        'Kofi Mensah',
      );
    });

    it('is null for someone with no name', async () => {
      await expect(service.nameFor('tenant-1', 'ghost')).resolves.toBeNull();
    });

    it('is null, not an error, when the directory is down', async () => {
      users.names.mockRejectedValue(new Error('down'));

      await expect(service.nameFor('tenant-1', 'user-2')).resolves.toBeNull();
    });
  });

  describe('list', () => {
    it('is for people who can assign', async () => {
      await expect(service.list(user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(auth.moduleUsers).not.toHaveBeenCalled();
    });

    it('offers only active Marketing users, by name', async () => {
      await expect(
        service.list(withPermissions(P.PROSPECTS_ASSIGN)),
      ).resolves.toEqual([
        { userId: 'user-3', name: 'Ama Mensah', email: 'Ama@example.com' },
        { userId: 'user-2', name: 'Kofi Mensah', email: 'Kofi@example.com' },
      ]);
    });
  });

  it('guards the picker route with either assign permission', () => {
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        AssigneesController.prototype.list,
      ),
    ).toEqual([P.PROSPECTS_ASSIGN, P.CLIENTS_ASSIGN]);
  });
});

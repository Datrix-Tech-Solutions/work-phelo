/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { AssigneesService } from './assignees.service';
import { AssigneesController } from './assignees.controller';
import { ANY_PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

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

  let directory: { list: jest.Mock; resolve: jest.Mock };
  let service: AssigneesService;

  beforeEach(() => {
    directory = {
      list: jest.fn(),
      resolve: jest.fn().mockResolvedValue({ person: null, people: [] }),
    };
    service = new AssigneesService(directory as unknown as HrDirectoryClient);
  });

  describe('forCreate', () => {
    it('assigns the creator when nobody else is chosen', async () => {
      await expect(service.forCreate(user, 'prospect')).resolves.toBe('user-1');
      expect(directory.resolve).not.toHaveBeenCalled();
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
      expect(directory.resolve).not.toHaveBeenCalled();
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

    it('lets a user with the permission pick an active employee', async () => {
      await expect(
        service.forCreate(
          withPermissions(P.PROSPECTS_ASSIGN),
          'prospect',
          'user-2',
        ),
      ).resolves.toBe('user-2');
      expect(directory.resolve).toHaveBeenCalledWith('tenant-1', {
        userIds: ['user-2'],
      });
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

    it('refuses a person who is not an active employee with an account', async () => {
      directory.resolve.mockRejectedValue(
        new HttpException('One or more users were not found', 404),
      );

      await expect(
        service.forCreate(withPermissions(P.CLIENTS_ASSIGN), 'client', 'ghost'),
      ).rejects.toBeInstanceOf(BadRequestException);
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
      expect(directory.resolve).not.toHaveBeenCalled();
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

  describe('list', () => {
    it('is for people who can assign', async () => {
      await expect(service.list(user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(directory.list).not.toHaveBeenCalled();
    });

    it('offers active employees who have an account', async () => {
      directory.list.mockResolvedValue([
        { employeeId: 'e1', userId: 'u1', name: 'Ama', department: 'Sales' },
        { employeeId: 'e2', userId: null, name: 'Kofi', department: null },
      ]);

      await expect(
        service.list(withPermissions(P.PROSPECTS_ASSIGN)),
      ).resolves.toEqual([{ userId: 'u1', name: 'Ama', department: 'Sales' }]);
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

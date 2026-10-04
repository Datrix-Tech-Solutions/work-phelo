import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { AuthDirectoryClient } from '../appointments/auth-directory.client';
import { AuthUsersClient } from './auth-users.client';

export type AssignableRecord = 'prospect' | 'client';

const NO_PERMISSION_MESSAGE = "You don't have permission to assign records.";
const NOT_ASSIGNABLE_MESSAGE =
  'The selected person cannot be assigned. Choose an active Marketing user.';
const USERS_UNAVAILABLE_MESSAGE =
  'The list of Marketing users is temporarily unavailable. Please try again.';

/**
 * Who a prospect or client belongs to. A record is assigned to whoever creates it; people with the
 * assign permission can give it to someone else, when creating it or afterwards - but only to users
 * of the Marketing module.
 */
@Injectable()
export class AssigneesService {
  private readonly logger = new Logger(AssigneesService.name);

  constructor(
    private readonly authDirectory: AuthDirectoryClient,
    private readonly authUsers: AuthUsersClient,
  ) {}

  canAssign(user: RequestUser, record: AssignableRecord): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;
    return user.permissions.includes(
      record === 'prospect' ? P.PROSPECTS_ASSIGN : P.CLIENTS_ASSIGN,
    );
  }

  canAssignAny(user: RequestUser): boolean {
    return this.canAssign(user, 'prospect') || this.canAssign(user, 'client');
  }

  /**
   * The user a new record is assigned to: the creator unless they picked someone, which needs the
   * assign permission.
   */
  async forCreate(
    user: RequestUser,
    record: AssignableRecord,
    requested?: string,
  ): Promise<string> {
    if (!requested || requested === user.id) return user.id;
    return this.validated(user, record, requested);
  }

  /**
   * The user to move an existing record to, or null when the assignee is not changing. Picking the
   * current assignee again changes nothing and needs no permission.
   */
  async forUpdate(
    user: RequestUser,
    record: AssignableRecord,
    current: string,
    requested?: string,
  ): Promise<string | null> {
    if (!requested || requested === current) return null;
    return this.validated(user, record, requested);
  }

  /** Active Marketing users, for the "Assigned to" picker. */
  async list(user: RequestUser) {
    if (!this.canAssignAny(user)) {
      throw new ForbiddenException(NO_PERMISSION_MESSAGE);
    }
    const users = await this.activeModuleUsers(user.tenantId);
    return users
      .map((u) => ({ userId: u.id, name: this.fullName(u), email: u.email }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Names for display, for any user of the tenant - not only Marketing users, since a record can
   * belong to an admin who holds no Marketing permission set. Best effort: a name that cannot be
   * found is left out, and must never break a prospect or client page.
   */
  async namesFor(
    tenantId: string,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const wanted = [...new Set(userIds)].slice(0, 50);
    if (wanted.length === 0) return names;

    try {
      for (const u of await this.authUsers.names(tenantId, wanted)) {
        names.set(u.id, this.fullName(u));
      }
    } catch (error) {
      this.logUnavailable(error);
    }
    return names;
  }

  async nameFor(tenantId: string, userId: string): Promise<string | null> {
    return (await this.namesFor(tenantId, [userId])).get(userId) ?? null;
  }

  private async validated(
    user: RequestUser,
    record: AssignableRecord,
    requested: string,
  ): Promise<string> {
    if (!this.canAssign(user, record)) {
      throw new ForbiddenException(NO_PERMISSION_MESSAGE);
    }
    const users = await this.activeModuleUsers(user.tenantId);
    if (!users.some((u) => u.id === requested)) {
      throw new BadRequestException(NOT_ASSIGNABLE_MESSAGE);
    }
    return requested;
  }

  private async activeModuleUsers(tenantId: string) {
    try {
      const users = await this.authDirectory.moduleUsers(tenantId);
      return users.filter((u) => u.status === 'ACTIVE');
    } catch (error) {
      this.logUnavailable(error);
      throw new ServiceUnavailableException(USERS_UNAVAILABLE_MESSAGE);
    }
  }

  private fullName(u: { firstName: string; lastName: string }) {
    return `${u.firstName} ${u.lastName}`.trim();
  }

  private logUnavailable(error: unknown) {
    this.logger.warn(
      `user directory unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

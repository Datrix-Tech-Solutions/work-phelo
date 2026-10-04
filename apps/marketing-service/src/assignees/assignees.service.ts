import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { callHr } from '../hr/call-hr';
import { HrDirectoryClient } from '../hr/hr-directory.client';

export type AssignableRecord = 'prospect' | 'client';

const NO_PERMISSION_MESSAGE = "You don't have permission to assign records.";
const NOT_ASSIGNABLE_MESSAGE =
  'The selected person cannot be assigned. Choose an active employee with a user account.';

/**
 * Who a prospect or client belongs to. A record is assigned to whoever creates it; people with the
 * assign permission can give it to someone else, when creating it or afterwards.
 */
@Injectable()
export class AssigneesService {
  private readonly logger = new Logger(AssigneesService.name);

  constructor(private readonly directory: HrDirectoryClient) {}

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

  /** Active employees who have a user account, for the "Assigned to" picker. */
  async list(user: RequestUser) {
    if (!this.canAssignAny(user)) {
      throw new ForbiddenException(NO_PERMISSION_MESSAGE);
    }
    const people = await callHr(this.logger, () =>
      this.directory.list(user.tenantId),
    );
    return people
      .filter((p) => !!p.userId)
      .map((p) => ({
        userId: p.userId,
        name: p.name,
        department: p.department,
      }));
  }

  private async validated(
    user: RequestUser,
    record: AssignableRecord,
    requested: string,
  ): Promise<string> {
    if (!this.canAssign(user, record)) {
      throw new ForbiddenException(NO_PERMISSION_MESSAGE);
    }
    try {
      await callHr(this.logger, () =>
        this.directory.resolve(user.tenantId, { userIds: [requested] }),
      );
    } catch (error) {
      if (this.isNotFound(error)) {
        throw new BadRequestException(NOT_ASSIGNABLE_MESSAGE);
      }
      throw error;
    }
    return requested;
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'getStatus' in error &&
      typeof (error as { getStatus: unknown }).getStatus === 'function' &&
      (error as { getStatus: () => number }).getStatus() === 404
    );
  }
}

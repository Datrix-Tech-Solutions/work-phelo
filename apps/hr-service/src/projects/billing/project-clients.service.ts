import { ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, ProjectClient } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HR_PERMISSION_DENY_MESSAGE,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../../auth/access-scope';

/** One spelling of a name for comparing: trimmed, inner whitespace collapsed, case ignored. */
export const clientNameKey = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

const serialize = (c: ProjectClient) => ({
  id: c.id,
  name: c.name,
  source: 'PROJECT' as const,
});

/** The clients made from project management, for companies marketing does not know. */
@Injectable()
export class ProjectClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Anyone who can start a project can pick a client for it. */
  private assertCanUse(user: RequestUser) {
    if (
      !isCompanyAdminUser(user) &&
      !hasPermissionRule(user, 'projects:CREATE') &&
      !hasPermissionRule(user, 'projects:EDIT')
    ) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
  }

  async list(tenantId: string, user: RequestUser, search?: string) {
    this.assertCanUse(user);
    const term = search?.trim();
    const clients = await this.prisma.projectClient.findMany({
      where: {
        tenantId,
        ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
    return clients.map(serialize);
  }

  /** Adding a name that is already there gives back the client that exists, never a second one. */
  async create(tenantId: string, user: RequestUser, name: string) {
    this.assertCanUse(user);
    const nameKey = clientNameKey(name);
    const find = () =>
      this.prisma.projectClient.findUnique({
        where: { tenantId_nameKey: { tenantId, nameKey } },
      });

    const existing = await find();
    if (existing) return serialize(existing);

    try {
      const created = await this.prisma.projectClient.create({
        data: {
          tenantId,
          name: name.trim().replace(/\s+/g, ' '),
          nameKey,
          createdByUserId: user.id,
        },
      });
      return serialize(created);
    } catch (e) {
      // The same name added at the same moment from two requests.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const again = await find();
        if (again) return serialize(again);
      }
      throw e;
    }
  }
}

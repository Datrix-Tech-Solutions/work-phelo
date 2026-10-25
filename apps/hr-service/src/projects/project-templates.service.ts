import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma, ProjectTemplate } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  HR_PERMISSION_DENY_MESSAGE,
  hasPermissionRule,
  isCompanyAdminUser,
} from '../auth/access-scope';
import { ProjectTemplateDto } from './dto/project-template.dto';

/** Templates a company keeps for starting projects. The built-in ones ship with the app; a company's
 *  edit of one is a row with its `defaultKey`. */
@Injectable()
export class ProjectTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanManage(user: RequestUser) {
    if (
      !(
        isCompanyAdminUser(user) ||
        hasPermissionRule(user, 'projects:CREATE') ||
        hasPermissionRule(user, 'projects:EDIT')
      )
    ) {
      throw new ForbiddenException(HR_PERMISSION_DENY_MESSAGE);
    }
  }

  private serialize(row: ProjectTemplate) {
    const config = row.config as unknown as Record<string, unknown>;
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      defaultKey: row.defaultKey,
      isDefault: false,
      createdAt: row.createdAt,
      ...config,
    };
  }

  async list(tenantId: string) {
    const rows = await this.prisma.projectTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(tenantId: string, user: RequestUser, dto: ProjectTemplateDto) {
    this.assertCanManage(user);
    const row = await this.prisma.projectTemplate.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        config: dto.config as unknown as Prisma.InputJsonValue,
      },
    });
    return this.serialize(row);
  }

  async update(
    tenantId: string,
    user: RequestUser,
    id: string,
    dto: ProjectTemplateDto,
  ) {
    this.assertCanManage(user);
    const existing = await this.prisma.projectTemplate.findFirst({
      where: { id, tenantId, defaultKey: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Template not found');
    const row = await this.prisma.projectTemplate.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        config: dto.config as unknown as Prisma.InputJsonValue,
      },
    });
    return this.serialize(row);
  }

  async remove(tenantId: string, user: RequestUser, id: string) {
    this.assertCanManage(user);
    const { count } = await this.prisma.projectTemplate.deleteMany({
      where: { id, tenantId, defaultKey: null },
    });
    if (count === 0) throw new NotFoundException('Template not found');
    return { message: 'Template deleted successfully' };
  }

  /** Saves the company's edit of a built-in template. */
  async saveDefault(
    tenantId: string,
    user: RequestUser,
    defaultKey: string,
    dto: ProjectTemplateDto,
  ) {
    this.assertCanManage(user);
    const data = {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      config: dto.config as unknown as Prisma.InputJsonValue,
    };
    const row = await this.prisma.projectTemplate.upsert({
      where: { tenantId_defaultKey: { tenantId, defaultKey } },
      update: data,
      create: { tenantId, defaultKey, ...data },
    });
    return this.serialize(row);
  }

  /** Drops the company's edit, restoring the built-in template to how it shipped. */
  async resetDefault(tenantId: string, user: RequestUser, defaultKey: string) {
    this.assertCanManage(user);
    await this.prisma.projectTemplate.deleteMany({
      where: { tenantId, defaultKey },
    });
    return { message: 'Template restored successfully' };
  }
}

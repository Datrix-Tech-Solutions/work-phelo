import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    createdById: string,
    dto: { title: string; body: string },
  ) {
    return this.prisma.announcement.create({
      data: { tenantId, createdById, ...dto },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.announcement.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { message: 'Announcement deleted successfully' };
  }
}

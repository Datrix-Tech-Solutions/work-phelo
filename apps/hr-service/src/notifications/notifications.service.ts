import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecent(userId: string, tenantId: string) {
    return this.prisma.notification.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string, tenantId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, tenantId, isRead: false },
    });
    return { count };
  }

  async getAll(
    userId: string,
    tenantId: string,
    filter?: string,
    page = 1,
    limit = 25,
  ) {
    const where: any = { userId, tenantId };
    if (filter === 'read') where.isRead = true;
    if (filter === 'unread') where.isRead = false;

    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markRead(userId: string, tenantId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string, tenantId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: 'All notifications marked as read' };
  }

  async delete(userId: string, tenantId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted successfully' };
  }

  async create(data: {
    tenantId: string;
    userId: string;
    type: string;
    message: string;
    link?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  async createMany(
    notifications: {
      tenantId: string;
      userId: string;
      type: string;
      message: string;
      link?: string;
    }[],
  ) {
    return this.prisma.notification.createMany({ data: notifications });
  }
}

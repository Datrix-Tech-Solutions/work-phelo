import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryInAppNotificationsDto } from './dto/query-in-app-notifications.dto';
import { InAppNotificationsService } from './in-app-notifications.service';

type AuthenticatedRequest = Request & { user: RequestUser };

@UseGuards(JwtAuthGuard)
@Controller('in-app')
export class InAppNotificationsController {
  constructor(private readonly notifications: InAppNotificationsService) {}

  @Get()
  getRecent(@Req() req: AuthenticatedRequest) {
    return this.notifications.getRecent(req.user.id, req.user.tenantId);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notifications.getUnreadCount(req.user.id, req.user.tenantId);
  }

  @Get('all')
  getAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryInAppNotificationsDto,
  ) {
    return this.notifications.getAll(
      req.user.id,
      req.user.tenantId,
      query.filter,
      query.page,
      query.limit,
    );
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notifications.markAllRead(req.user.id, req.user.tenantId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notifications.markRead(req.user.id, req.user.tenantId, id);
  }

  @Delete(':id')
  archive(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notifications.archive(req.user.id, req.user.tenantId, id);
  }
}

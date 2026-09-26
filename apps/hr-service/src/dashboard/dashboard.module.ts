import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AvatarUrlResolverService } from '../common/avatar-url-resolver.service';

@Module({
  imports: [AnnouncementsModule],
  controllers: [DashboardController],
  providers: [DashboardService, AvatarUrlResolverService],
})
export class DashboardModule {}

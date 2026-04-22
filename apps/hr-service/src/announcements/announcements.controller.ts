import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isCompanyAdminUser } from '../auth/access-scope';

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a company announcement — Company Admin only',
  })
  @ApiBody({
    schema: {
      example: {
        title: 'Office Closure Notice',
        body: 'The office will be closed on Friday April 5th for a public holiday.',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Announcement created' })
  create(@Body() dto: { title: string; body: string }, @Req() req: any) {
    if (!isCompanyAdminUser(req.user)) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }
    return this.announcementsService.create(
      req.user.tenantId,
      req.user.id,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all announcements for the company' })
  @ApiResponse({ status: 200, description: 'Announcements retrieved' })
  findAll(@Req() req: any) {
    return this.announcementsService.findAll(req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an announcement' })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement deleted' })
  remove(@Param('id') id: string, @Req() req: any) {
    if (!isCompanyAdminUser(req.user)) {
      throw new ForbiddenException(
        "You don't have permission to access this. Contact your administrator.",
      );
    }
    return this.announcementsService.remove(req.user.tenantId, id);
  }
}

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  ApiErrorResponseDto,
  PlacementEmailThreadConversationDto,
  PlacementEmailThreadSummaryDto,
} from './dto/email-response.dto';
import { EmailPermission } from './email.permissions';
import { EmailThreadsService } from './email-threads.service';

@Controller('placements/:placementId/email')
@ApiTags('Reinsurance - Placement Emails')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Module, feature or required permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('operations')
@RequireFeature('operations', 'reinsurance')
export class PlacementEmailThreadsController {
  constructor(private readonly emailThreadsService: EmailThreadsService) {}

  @Get('threads')
  @RequirePermissions(EmailPermission.VIEW)
  @ApiOperation({
    summary: 'List email threads linked to a placement',
    description:
      'Returns manually linked mailbox threads for the placement. This is read-only and does not send, reply to, or mutate email messages.',
  })
  @ApiParam({ name: 'placementId', format: 'uuid' })
  @ApiOkResponse({ type: [PlacementEmailThreadSummaryDto] })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findPlacementThreads(
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.emailThreadsService.findPlacementThreads(
      request.user.tenantId,
      placementId,
    );
  }

  @Get('threads/:threadId')
  @RequirePermissions(EmailPermission.VIEW)
  @ApiOperation({
    summary: 'Get a placement email thread conversation',
    description:
      'Returns the linked thread summary and messages in chronological order for conversation-style placement email views.',
  })
  @ApiParam({ name: 'placementId', format: 'uuid' })
  @ApiParam({ name: 'threadId', format: 'uuid' })
  @ApiOkResponse({ type: PlacementEmailThreadConversationDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findPlacementThread(
    @Param('placementId', ParseUUIDPipe) placementId: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.emailThreadsService.findPlacementThread(
      request.user.tenantId,
      placementId,
      threadId,
    );
  }
}

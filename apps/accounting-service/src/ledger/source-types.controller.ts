import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingPermission } from './accounting.permissions';
import { SourceTypesService } from './source-types.service';

@Controller('source-types')
@ApiTags('Accounting - Source Types')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class SourceTypesController {
  constructor(private readonly service: SourceTypesService) {}

  @Get()
  @ApiOperation({
    summary: 'List source types other modules have linked into Accounting',
  })
  @RequirePermissions(AccountingPermission.SETTINGS_VIEW)
  list(@Req() request: Request & { user: RequestUser }) {
    return this.service.list(request.user);
  }

  @Post(':id/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-link a source type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  link(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.link(request.user, id);
  }

  @Post(':id/unlink')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink a source type' })
  @RequirePermissions(AccountingPermission.SETTINGS_EDIT)
  unlink(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.service.unlink(request.user, id);
  }
}

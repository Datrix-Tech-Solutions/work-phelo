import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { ApiErrorResponseDto } from '../crm-settings/dto/prospecting-setting.dto';
import {
  GrantSmsCreditsDto,
  QuerySmsLedgerDto,
} from './dto/sms-sender-identity.dto';
import { SmsWalletService } from './sms-wallet.service';

const { SMS_WALLET_VIEW, SMS_CREDITS_ADJUST } = MarketingCrmSettingsPermission;

type AuthedRequest = Request & { user: RequestUser };

@Controller('sms-wallet')
@ApiTags('Marketing - SMS Wallet')
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: 'Missing or invalid session/token.',
})
@ApiForbiddenResponse({
  type: ApiErrorResponseDto,
  description: 'Marketing module or SMS wallet permission is unavailable.',
})
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('marketing')
export class SmsWalletController {
  constructor(private readonly service: SmsWalletService) {}

  @Get('balance')
  @RequireAnyPermission(SMS_WALLET_VIEW)
  @ApiOperation({ summary: 'Get tenant SMS credit wallet balance' })
  getBalance(@Req() request: AuthedRequest) {
    return this.service.getBalance(request.user.tenantId);
  }

  @Get('ledger')
  @RequireAnyPermission(SMS_WALLET_VIEW)
  @ApiOperation({ summary: 'List immutable tenant SMS credit ledger entries' })
  listLedger(@Query() query: QuerySmsLedgerDto, @Req() request: AuthedRequest) {
    return this.service.listLedger(request.user.tenantId, query);
  }

  @Post('admin-grants')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission(SMS_CREDITS_ADJUST)
  @ApiOperation({
    summary: 'Grant SMS credits administratively',
    description:
      'Operational/dev foundation endpoint. Customer recharge/payment provider integration is intentionally outside this phase.',
  })
  grant(@Body() dto: GrantSmsCreditsDto, @Req() request: AuthedRequest) {
    return this.service.grantCredits(request.user, dto);
  }
}

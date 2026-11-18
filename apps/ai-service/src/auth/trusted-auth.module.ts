import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TrustedAuthGuard } from './trusted-auth.guard';
import { TrustedContextService } from './trusted-context.service';

@Module({
  imports: [ConfigModule],
  providers: [TrustedContextService, TrustedAuthGuard],
  exports: [TrustedAuthGuard, TrustedContextService],
})
export class TrustedAuthModule {}

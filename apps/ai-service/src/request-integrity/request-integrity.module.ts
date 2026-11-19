import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TrustedAuthModule } from '../auth/trusted-auth.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { RequestVerificationKeys } from './verification-keys';
import { RequestIntegrityService } from './request-integrity.service';

@Module({
  imports: [ConfigModule, TrustedAuthModule, PersistenceModule],
  providers: [RequestVerificationKeys, RequestIntegrityService],
  exports: [RequestIntegrityService],
})
export class RequestIntegrityModule {}

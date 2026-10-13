import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { DriverLicenceService } from '../employees/driver-licence.service';
import { DirectoryService } from './directory.service';
import { InternalDirectoryController } from './internal-directory.controller';

@Module({
  imports: [CryptoModule],
  controllers: [InternalDirectoryController],
  providers: [DirectoryService, DriverLicenceService],
})
export class DirectoryModule {}

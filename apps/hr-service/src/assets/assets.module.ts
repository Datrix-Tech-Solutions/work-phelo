import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { InternalFleetAssetsController } from './internal-fleet-assets.controller';
import { AssetsService } from './assets.service';

@Module({
  controllers: [AssetsController, InternalFleetAssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}

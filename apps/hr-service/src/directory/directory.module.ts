import { Module } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { InternalDirectoryController } from './internal-directory.controller';

@Module({
  controllers: [InternalDirectoryController],
  providers: [DirectoryService],
})
export class DirectoryModule {}

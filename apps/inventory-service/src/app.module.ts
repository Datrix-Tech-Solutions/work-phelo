import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, HealthModule, InventoryModule],
})
export class AppModule {}

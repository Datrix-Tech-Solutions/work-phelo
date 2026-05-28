import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module';
import { CounterpartiesModule } from './counterparties/counterparties.module';
import { HealthModule } from './health/health.module';
import { PlacementsModule } from './placements/placements.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AccessModule,
    CounterpartiesModule,
    PlacementsModule,
  ],
})
export class AppModule {}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../prisma/generated/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // The default 5s transaction timeout is too tight for the posting flows, which do
    // several sequential round trips (rule/account lookups, journal creation, audit log)
    // inside one interactive transaction — over network DB latency this was closing the
    // transaction mid-flight, surfacing as "Transaction not found ... old closed transaction".
    super({
      transactionOptions: {
        maxWait: 10000,
        timeout: 20000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

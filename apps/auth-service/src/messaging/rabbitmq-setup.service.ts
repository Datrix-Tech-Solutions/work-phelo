import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

const DLX = 'workphelo.dlx';

@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetupService.name);

  async onModuleInit() {
    const url =
      process.env.RABBITMQ_URL || 'amqp://erp:erppassword@localhost:5672';
    let connection: Awaited<ReturnType<typeof amqp.connect>> | undefined;
    try {
      connection = await amqp.connect(url);
      const channel = await connection.createChannel();

      await channel.assertExchange(DLX, 'direct', { durable: true });

      await channel.assertQueue('auth_queue.dlq', { durable: true });
      await channel.bindQueue('auth_queue.dlq', DLX, 'auth_queue');

      await channel.close();
      this.logger.log('RabbitMQ DLX and DLQs ready');
    } catch (err) {
      this.logger.error('Failed to set up RabbitMQ DLX/DLQs', err);
    } finally {
      await connection?.close();
    }
  }
}

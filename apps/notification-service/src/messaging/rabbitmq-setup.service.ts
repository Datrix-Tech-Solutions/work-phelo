import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

const DLX = 'workphelo.dlx';

@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetupService.name);

  async onModuleInit() {
    const url =
      process.env.RABBITMQ_URL || 'amqp://erp:erppassword@localhost:5672';
    let connection: amqp.Connection | null = null;
    try {
      connection = await amqp.connect(url);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const channel: amqp.Channel = await connection.createChannel();

      await channel.assertExchange(DLX, 'direct', { durable: true });

      await channel.assertQueue('notification_queue.dlq', { durable: true });
      await channel.bindQueue(
        'notification_queue.dlq',
        DLX,
        'notification_queue',
      );

      await channel.close();
      this.logger.log('RabbitMQ DLX and DLQs ready');
    } catch (err) {
      this.logger.error('Failed to set up RabbitMQ DLX/DLQs', err);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (connection) await connection.close();
    }
  }
}

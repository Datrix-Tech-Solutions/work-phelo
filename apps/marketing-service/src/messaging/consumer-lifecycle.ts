import { INestApplication } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { marketingActivation } from '../config/activation';

export async function startMarketingConsumers(
  app: INestApplication,
): Promise<void> {
  if (!marketingActivation('MARKETING_RABBITMQ_CONSUMER_ENABLED')) return;
  const url = process.env.RABBITMQ_URL;
  if (!url)
    throw new Error(
      'RABBITMQ_URL is required when Marketing consumers are enabled',
    );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: 'marketing_queue',
      queueOptions: { durable: true, arguments: { 'x-message-ttl': 3600000 } },
      noAck: false,
      prefetchCount: 10,
    },
  });
  try {
    await app.startAllMicroservices();
  } catch {
    await app.close();
    throw new Error('Marketing RabbitMQ startup unavailable');
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RabbitMQPublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  emit(pattern: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.notificationClient.emit(pattern, data).subscribe({
        complete: () => resolve(),
        error: (err) => {
          this.logger.error(`Failed to emit event ${pattern}`, err);
          reject(err);
        },
      });
    });
  }

  emitToAuth(pattern: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.authClient.emit(pattern, data).subscribe({
        complete: () => resolve(),
        error: (err) => {
          this.logger.error(`Failed to emit auth event ${pattern}`, err);
          reject(err);
        },
      });
    });
  }
}

import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseRuntimeEnv } from '../config/runtime-env';

@Injectable()
export class FoundationReadinessService implements BeforeApplicationShutdown {
  private stopping = false;
  constructor(private readonly config: ConfigService) {}

  isReady(): boolean {
    if (this.stopping) return false;
    try {
      const enabled = this.config.get<unknown>('AI_ENABLED');
      const mockEnabled = this.config.get<unknown>('AI_MOCK_ENABLED');
      const port = this.config.get<unknown>('AI_SERVICE_PORT');
      const timeout = this.config.get<unknown>('AI_REQUEST_TIMEOUT_MS');
      if (
        typeof enabled !== 'boolean' ||
        typeof mockEnabled !== 'boolean' ||
        typeof port !== 'number' ||
        typeof timeout !== 'number'
      )
        return false;
      parseRuntimeEnv({
        NODE_ENV: this.config.get<unknown>('NODE_ENV'),
        AI_PROVIDER: this.config.get<unknown>('AI_PROVIDER'),
        AI_POLICY_VERSION: this.config.get<unknown>('AI_POLICY_VERSION'),
        AI_ENABLED: String(enabled),
        AI_MOCK_ENABLED: String(mockEnabled),
        AI_SERVICE_PORT: String(port),
        AI_REQUEST_TIMEOUT_MS: String(timeout),
      });
      return true;
    } catch {
      return false;
    }
  }

  beforeApplicationShutdown(): void {
    this.stopping = true;
  }
}

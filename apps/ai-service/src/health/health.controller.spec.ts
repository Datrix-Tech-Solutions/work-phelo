import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';
import { MockInferenceProvider } from '../inference/mock.provider';
import { FoundationReadinessService } from './foundation-readiness.service';
import { HealthController } from './health.controller';

describe('Probe dependency isolation', () => {
  const original = { ...process.env };
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...original };
  });

  it('performs no inference or network access from either probe', () => {
    process.env = {};
    const deny = () => {
      throw new Error('Unexpected probe side effect');
    };
    const spies = [
      jest.spyOn(http, 'request').mockImplementation(deny),
      jest.spyOn(http, 'get').mockImplementation(deny),
      jest.spyOn(https, 'request').mockImplementation(deny),
      jest.spyOn(https, 'get').mockImplementation(deny),
      jest.spyOn(net, 'connect').mockImplementation(deny),
      jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(deny),
      jest.spyOn(tls, 'connect').mockImplementation(deny),
      jest.spyOn(globalThis, 'fetch').mockImplementation(deny),
      jest.spyOn(MockInferenceProvider.prototype, 'generateText').mockImplementation(deny),
    ];
    const config = new ConfigService({
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      AI_ENABLED: false,
      AI_MOCK_ENABLED: false,
      AI_SERVICE_PORT: 4011,
      AI_REQUEST_TIMEOUT_MS: 5000,
      AI_POLICY_VERSION: 'test-v1',
    });
    const controller = new HealthController(new FoundationReadinessService(config));
    expect(controller.health()).toEqual({ status: 'ok', service: 'ai-service' });
    expect(controller.ready({} as Response)).toEqual({
      status: 'ready',
      service: 'ai-service',
      inferenceAvailable: false,
    });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

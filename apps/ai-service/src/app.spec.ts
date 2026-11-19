import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { createApplication, startupErrorMessage } from './main';
import { RuntimeConfigurationError } from './config/runtime-env';

describe('AI foundation bootstrap', () => {
  const original = { ...process.env };
  let directory: string;

  beforeEach(() => {
    process.env = { NODE_ENV: 'test' };
    directory = mkdtempSync(join(tmpdir(), 'workphelo-ai-config-'));
  });

  afterEach(() => {
    process.env = { ...original };
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads the selected env file before validation and requires no external credentials', async () => {
    const file = join(directory, '.env');
    writeFileSync(file, 'AI_PROVIDER=mock\nAI_POLICY_VERSION=fixture-v1\nAI_SERVICE_PORT=4012\n');
    const app = await createApplication({ envFilePath: file });
    try {
      await app.init();
      const config = app.get(ConfigService);
      expect(config.get('AI_PROVIDER')).toBe('mock');
      expect(config.get('AI_SERVICE_PORT')).toBe(4012);
      expect(config.get('DATABASE_URL')).toBeUndefined();
      expect(config.get('JWT_SECRET')).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('gives the process environment precedence over the env file', async () => {
    const file = join(directory, '.env');
    writeFileSync(file, 'AI_PROVIDER=mock\nAI_POLICY_VERSION=file-v1\n');
    process.env.AI_POLICY_VERSION = 'process-v1';
    const app = await createApplication({ envFilePath: file });
    try {
      expect(app.get(ConfigService).get('AI_POLICY_VERSION')).toBe('process-v1');
    } finally {
      await app.close();
    }
  });

  it('fails safely before listening when configuration is missing', async () => {
    await expect(createApplication({ ignoreEnvFile: true })).rejects.toThrow('AI_PROVIDER');
  });

  it('does not expose business or inference endpoints even when flags are enabled', async () => {
    Object.assign(process.env, {
      AI_PROVIDER: 'mock',
      AI_POLICY_VERSION: 'test-v1',
      AI_ENABLED: 'true',
      AI_MOCK_ENABLED: 'true',
    });
    const app = await createApplication({ ignoreEnvFile: true }, () => undefined);
    try {
      await app.init();
      for (const path of [
        '/api/generate',
        '/api/chat',
        '/api/messages',
        '/api/conversations',
        '/generate',
      ]) {
        await request(app.getHttpServer())
          .post(path)
          .send({ tenantId: 'spoofed', userId: 'spoofed' })
          .expect(path === '/api/conversations' ? 503 : 404);
        await request(app.getHttpServer())
          .get(path)
          .expect(path === '/api/conversations' ? 503 : 404);
      }
      const response = await request(app.getHttpServer()).get('/api/missing');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Request rejected',
      });
      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200, { status: 'ok', service: 'ai-service' });
      await request(app.getHttpServer())
        .get('/api/ready')
        .expect(200, { status: 'ready', service: 'ai-service', inferenceAvailable: false });
    } finally {
      await app.close();
    }
  });

  it('reports only safe startup diagnostics', () => {
    expect(startupErrorMessage(new RuntimeConfigurationError('AI_PROVIDER'))).toBe(
      'Invalid or missing AI runtime configuration: AI_PROVIDER',
    );
    expect(startupErrorMessage(new Error('secret-token-and-stack'))).not.toContain('secret-token');
    expect(startupErrorMessage({ password: 'secret' })).not.toContain('secret');
  });
});

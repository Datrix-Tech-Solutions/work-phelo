import 'reflect-metadata';
import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApplication } from '../app.setup';
import { HttpLogEntry } from '../common/request-logging';
import { INFERENCE_PROVIDER } from '../inference/inference-provider';
import { FoundationReadinessService } from './foundation-readiness.service';

@Controller('accidental')
class UndeclaredController {
  @Get(':id')
  read() {
    throw new Error('Controller must never execute');
  }
  @Post()
  write() {
    throw new Error('Controller must never execute');
  }
}

describe('Foundation probes and default-deny HTTP policy', () => {
  const original = { ...process.env };
  let app: INestApplication<Server>;
  let entries: HttpLogEntry[];
  const generateText = jest.fn(() => {
    throw new Error('Probes must not call inference');
  });

  beforeEach(async () => {
    process.env = {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      AI_POLICY_VERSION: 'test-v1',
      AI_ENABLED: 'true',
      AI_MOCK_ENABLED: 'true',
    };
    entries = [];
    generateText.mockClear();
    const module = await Test.createTestingModule({
      imports: [AppModule.register({ ignoreEnvFile: true })],
      controllers: [UndeclaredController],
    })
      .overrideProvider(INFERENCE_PROVIDER)
      .useValue({ generateText })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({
      bodyParser: false,
      logger: false,
    });
    configureApplication(app, (entry) => entries.push(entry));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env = { ...original };
  });

  it('exposes exact minimal public probes without inference or configured data access', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok', service: 'ai-service' });
    await request(app.getHttpServer())
      .get('/api/ready')
      .expect(200, { status: 'ready', service: 'ai-service', inferenceAvailable: false });
    expect(generateText).not.toHaveBeenCalled();
    expect(entries.map((entry) => entry.route)).toEqual(['/api/health', '/api/ready']);
  });

  it('returns 503 for a demonstrably unready foundation without leaking details', async () => {
    app.get(FoundationReadinessService).beforeApplicationShutdown();
    await request(app.getHttpServer())
      .get('/api/ready')
      .expect(503, { status: 'not_ready', service: 'ai-service', inferenceAvailable: false });
    await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(entries[0].errorCode).toBe('FOUNDATION_NOT_READY');
  });

  it('denies an undeclared registered controller even with spoofed identity/context headers', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/accidental/private-record?token=private-query')
      .set('x-tenant-id', 'private-tenant')
      .set('x-user-id', 'private-user')
      .set('x-gateway-auth-context', 'private-forged-context')
      .set('Authorization', 'Bearer private-token')
      .set('Cookie', 'private-cookie')
      .set('x-request-id', 'private-request-id')
      .expect(403);
    expect(result.body).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(result.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(entries[0].route).toBe('/api/accidental/:id');
    expect(entries[0].errorCode).toBe('FORBIDDEN');
    expect(JSON.stringify(entries)).not.toMatch(/private-|Bearer|Cookie|token=/);
    await request(app.getHttpServer())
      .post('/api/accidental')
      .send({ prompt: 'private-body' })
      .expect(403);
    expect(JSON.stringify(entries)).not.toContain('private-body');
  });

  it('keeps unknown paths 404 and does not log their path/query', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/private-unknown?secret=private-query')
      .expect(404);
    expect(result.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(entries[0].route).toBe('[unmatched]');
    expect(JSON.stringify(entries)).not.toContain('private-');
  });

  it('does not grant exemptions to wrong verbs, trailing paths or bare prefixes', async () => {
    await request(app.getHttpServer()).post('/api/health').expect(404);
    await request(app.getHttpServer()).head('/api/health').expect(403);
    await request(app.getHttpServer()).get('/api/health/').expect(403);
    await request(app.getHttpServer()).get('/api/health/extra').expect(404);
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('ignores spoofed headers on probes and returns no operational configuration', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/ready?key=private-key')
      .set('x-user-id', 'private-user')
      .set('x-request-id', 'x'.repeat(10000))
      .expect(200);
    expect(result.body).toEqual({
      status: 'ready',
      service: 'ai-service',
      inferenceAvailable: false,
    });
    expect(JSON.stringify(entries)).not.toMatch(/private|DATABASE|AI_PROVIDER|http:\/\//);
  });
});

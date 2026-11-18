import 'reflect-metadata';
import { Body, Controller, Get, INestApplication, Param, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { Server } from 'http';
import request from 'supertest';
import { configureApplication } from './app.setup';
import { InferenceProviderError, ProviderErrorCode } from './inference/provider-error';

class FixtureDto {
  @IsString()
  name!: string;
}

// These routes exist only in the test module, never in AppModule.
@Controller('fixture')
class FixtureController {
  @Post()
  accept(@Body() body: FixtureDto) {
    return { name: body.name };
  }

  @Get()
  fail(): never {
    throw new Error('private-stack-or-token');
  }

  @Get('provider/:code')
  providerFailure(@Param('code') code: ProviderErrorCode): never {
    throw new InferenceProviderError(code);
  }
}

describe('AI HTTP bootstrap hardening', () => {
  it.each([
    ['CANCELLED', 408],
    ['DEADLINE_EXCEEDED', 504],
    ['UNAVAILABLE', 503],
    ['INVALID_RESPONSE', 502],
  ] as const)(
    'normalizes provider %s over HTTP without an inference endpoint',
    async (code, status) => {
      const result = await request(app.getHttpServer())
        .get(`/api/fixture/provider/${code}`)
        .expect(status);
      expect(result.body).toMatchObject({ code, statusCode: status });
      expect(JSON.stringify(result.body)).not.toMatch(/stack|\/private\/|submissionState/);
      expect(result.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    },
  );
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [FixtureController] }).compile();
    app = module.createNestApplication<INestApplication<Server>>({
      bodyParser: false,
      logger: false,
    });
    configureApplication(app, () => undefined);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies the /api prefix and accepts valid DTOs', async () => {
    await request(app.getHttpServer())
      .post('/api/fixture')
      .send({ name: 'test' })
      .expect(201, { name: 'test' });
    await request(app.getHttpServer()).get('/fixture').expect(404);
  });

  it('rejects unknown DTO fields and invalid values', async () => {
    await request(app.getHttpServer())
      .post('/api/fixture')
      .send({ name: 'test', tenantId: 'spoofed' })
      .expect(400);
    await request(app.getHttpServer()).post('/api/fixture').send({ name: 123 }).expect(400);
  });

  it('bounds JSON requests to 32 KiB', async () => {
    await request(app.getHttpServer())
      .post('/api/fixture')
      .send({ name: 'x'.repeat(33000) })
      .expect(413);
  });

  it('rejects malformed JSON without echoing its contents', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/fixture')
      .set('Content-Type', 'application/json')
      .send('{"secret-token":')
      .expect(400);
    expect(JSON.stringify(result.body)).not.toContain('secret-token');
  });

  it('does not expose exception messages or stacks', async () => {
    const result = await request(app.getHttpServer()).get('/api/fixture').expect(500);
    expect(result.body).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Service unavailable',
    });
  });
});

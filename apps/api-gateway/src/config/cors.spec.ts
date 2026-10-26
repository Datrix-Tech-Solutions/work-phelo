import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { httpCorsOptions } from './cors';

@Controller('recruitment-probe')
class ProbeController {
  @Get() get() {
    return {};
  }
}

describe('Gateway applicant CORS', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = module.createNestApplication();
    app.enableCors(httpCorsOptions());
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('accepts draft-token and Authorization headers without enabling arbitrary headers', async () => {
    const origin = httpCorsOptions().origin[0];
    const res = await request(app.getHttpServer())
      .options('/recruitment-probe')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'PATCH')
      .set(
        'Access-Control-Request-Headers',
        'content-type,authorization,x-application-access-token',
      )
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(
      res.headers['access-control-allow-headers'].toLowerCase().split(','),
    ).toEqual(['content-type', 'authorization', 'x-application-access-token']);
    expect(res.headers['access-control-allow-headers']).not.toContain('*');
  });
  it('does not grant cross-origin access to an unconfigured origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/recruitment-probe')
      .set('Origin', 'https://unapproved-careers.invalid')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'x-application-access-token');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { setupSwagger } from './swagger.config';

describe('setupSwagger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers Swagger routes under the service global prefix', () => {
    const app = {} as INestApplication;
    const document = { openapi: '3.0.0' };

    jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue(document as never);
    const setupSpy = jest.spyOn(SwaggerModule, 'setup').mockImplementation();

    setupSwagger(app);

    expect(setupSpy).toHaveBeenCalledWith('docs', app, document, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'docs-json',
      yamlDocumentUrl: 'docs-yaml',
    });
  });
});

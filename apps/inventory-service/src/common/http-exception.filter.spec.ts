import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('Inventory safe HTTP exceptions', () => {
  afterEach(() => jest.restoreAllMocks());
  function setup() {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'GET', path: '/api/health' }),
      }),
    } as unknown as ArgumentsHost;
    return { response, host };
  }
  it('does not expose unexpected infrastructure errors or stacks', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { response, host } = setup();
    new HttpExceptionFilter().catch(new Error('postgresql://secret-host/private-secret'), host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'An unexpected error occurred',
      error: 'Internal Server Error',
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('private-secret');
  });
  it('preserves intentional validation HTTP responses', () => {
    const { response, host } = setup();
    const error = new BadRequestException('Invalid request data');
    new HttpExceptionFilter().catch(error, host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(error.getResponse());
  });
});

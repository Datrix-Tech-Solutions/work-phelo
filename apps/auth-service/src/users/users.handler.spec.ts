import { UsersHandler } from './users.handler';

type HandlerWithPrivateFormatters = {
  formatError(error: unknown): string;
  formatStack(error: unknown): string | undefined;
};

describe('UsersHandler RPC diagnostics', () => {
  function makeHandler() {
    return new UsersHandler(
      {} as never,
    ) as unknown as HandlerWithPrivateFormatters;
  }

  it('includes useful Prisma error details even when the message is empty', () => {
    const handler = makeHandler();
    const error = Object.assign(new Error(''), {
      code: 'P2003',
      meta: {
        modelName: 'UserPermissionSet',
        field_name: 'UserPermissionSet_userId_fkey',
      },
    });

    expect(handler.formatError(error)).toContain('type=Error');
    expect(handler.formatError(error)).toContain('message=<empty>');
    expect(handler.formatError(error)).toContain('code=P2003');
    expect(handler.formatError(error)).toContain(
      'UserPermissionSet_userId_fkey',
    );
  });

  it('formats stack traces onto one log-safe line', () => {
    const handler = makeHandler();
    const error = new Error('failure');

    const stack = handler.formatStack(error);

    expect(stack).toContain('Error: failure');
    expect(stack).not.toContain('\n');
  });
});

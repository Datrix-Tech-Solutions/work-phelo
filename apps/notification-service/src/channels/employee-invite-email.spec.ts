import axios from 'axios';
import { EmailService } from './email.service';
jest.mock('axios');
const post = (
  axios as unknown as { post: jest.MockedFunction<typeof axios.post> }
).post;

describe('Employee invite provider idempotency', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-only-key';
    process.env.RESEND_FROM_EMAIL = 'test@example.test';
    process.env.FRONTEND_BASE_URL = 'http://localhost:3000';
    post.mockResolvedValue({ data: { id: 'provider-message' } });
  });
  afterAll(() => {
    for (const key of [
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'FRONTEND_BASE_URL',
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  it('sets a bounded timeout and Idempotency-Key only for durable employee invitations', async () => {
    const service = new EmailService();
    await service.sendEmployeeInviteEmail(
      'person@example.test',
      'Ama',
      'Tenant',
      'http://localhost:3000/invite',
      'employee-access/test-operation',
    );
    expect(post).toHaveBeenLastCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ to: 'person@example.test' }),
      expect.any(Object),
    );
    const durableConfig: unknown = post.mock.calls.at(-1)?.[2];
    expect(durableConfig).toHaveProperty('timeout', 8000);
    expect(durableConfig).toHaveProperty(
      'headers.Idempotency-Key',
      'employee-access/test-operation',
    );
    await service.sendEmployeeInviteEmail(
      'person@example.test',
      'Ama',
      'Tenant',
      'http://localhost:3000/invite',
    );
    const config: unknown = post.mock.calls.at(-1)?.[2];
    expect(config).not.toHaveProperty('headers.Idempotency-Key');
  });
});

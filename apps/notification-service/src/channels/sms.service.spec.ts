import { AgooSmsProvider } from './agoosms-sms.provider';
import { PiloSmsProvider } from './pilosms.provider';
import { SasuSyncSmsProvider } from './sasusync-sms.provider';
import type {
  SmsProvider,
  SmsSendOptions,
  SmsSendResult,
} from './sms-provider.interface';
import { SmsService } from './sms.service';
import { TermiiSmsProvider } from './termii-sms.provider';

describe('SmsService provider routing', () => {
  const originalEnv = process.env;
  const termiiResult: SmsSendResult = {
    success: true,
    status: 'SENT',
    provider: 'termii',
    providerStatus: 'ok',
  };
  const piloResult: SmsSendResult = {
    success: true,
    status: 'SENT',
    provider: 'pilosms',
    providerStatus: '1001',
    providerDetail: 'Message(s) processed successfully',
  };
  const sasuSyncResult: SmsSendResult = {
    success: true,
    status: 'SENT',
    provider: 'sasusync',
    providerStatus: 'queued',
    providerMessageId: 'job-123',
  };
  const agooSmsResult: SmsSendResult = {
    success: true,
    status: 'SENT',
    provider: 'agoosms',
    providerStatus: 'accepted',
    providerMessageId: 'agoo-123',
  };

  let termiiProvider: SmsProvider;
  let piloProvider: SmsProvider;
  let sasuSyncProvider: SmsProvider;
  let agooSmsProvider: SmsProvider;
  let termiiSendMessage: jest.Mock<
    Promise<SmsSendResult>,
    [string, string, SmsSendOptions?]
  >;
  let piloSendMessage: jest.Mock<
    Promise<SmsSendResult>,
    [string, string, SmsSendOptions?]
  >;
  let sasuSyncSendMessage: jest.Mock<
    Promise<SmsSendResult>,
    [string, string, SmsSendOptions?]
  >;
  let agooSmsSendMessage: jest.Mock<
    Promise<SmsSendResult>,
    [string, string, SmsSendOptions?]
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    termiiSendMessage = jest
      .fn<Promise<SmsSendResult>, [string, string, SmsSendOptions?]>()
      .mockImplementation(() => Promise.resolve(termiiResult));
    piloSendMessage = jest
      .fn<Promise<SmsSendResult>, [string, string, SmsSendOptions?]>()
      .mockImplementation(() => Promise.resolve(piloResult));
    sasuSyncSendMessage = jest
      .fn<Promise<SmsSendResult>, [string, string, SmsSendOptions?]>()
      .mockImplementation(() => Promise.resolve(sasuSyncResult));
    agooSmsSendMessage = jest
      .fn<Promise<SmsSendResult>, [string, string, SmsSendOptions?]>()
      .mockImplementation(() => Promise.resolve(agooSmsResult));
    termiiProvider = {
      provider: 'termii',
      sendMessage: termiiSendMessage,
    };
    piloProvider = {
      provider: 'pilosms',
      sendMessage: piloSendMessage,
    };
    sasuSyncProvider = {
      provider: 'sasusync',
      sendMessage: sasuSyncSendMessage,
    };
    agooSmsProvider = {
      provider: 'agoosms',
      sendMessage: agooSmsSendMessage,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('routes through Termii when SMS_PROVIDER=termii', async () => {
    process.env.SMS_PROVIDER = 'termii';

    const service = createService();
    await expect(service.sendMessage('+233244000001', 'Hello')).resolves.toBe(
      termiiResult,
    );

    expect(termiiSendMessage).toHaveBeenCalledWith(
      '+233244000001',
      'Hello',
      undefined,
    );
    expect(piloSendMessage).not.toHaveBeenCalled();
  });

  it('routes through AgooSMS when SMS_PROVIDER=agoosms', async () => {
    process.env.SMS_PROVIDER = 'agoosms';

    const service = createService();
    await expect(service.sendMessage('+233244000001', 'Hello')).resolves.toBe(
      agooSmsResult,
    );

    expect(agooSmsSendMessage).toHaveBeenCalledWith(
      '+233244000001',
      'Hello',
      undefined,
    );
    expect(termiiSendMessage).not.toHaveBeenCalled();
    expect(piloSendMessage).not.toHaveBeenCalled();
    expect(sasuSyncSendMessage).not.toHaveBeenCalled();
  });

  it('routes through PiloSMS when SMS_PROVIDER=pilosms', async () => {
    process.env.SMS_PROVIDER = 'pilosms';

    const service = createService();
    await expect(service.sendMessage('+233244000001', 'Hello')).resolves.toBe(
      piloResult,
    );

    expect(piloSendMessage).toHaveBeenCalledWith(
      '+233244000001',
      'Hello',
      undefined,
    );
    expect(termiiSendMessage).not.toHaveBeenCalled();
  });

  it('routes through SasuSync when SMS_PROVIDER=sasusync', async () => {
    process.env.SMS_PROVIDER = 'sasusync';

    const service = createService();
    await expect(service.sendMessage('+233244000001', 'Hello')).resolves.toBe(
      sasuSyncResult,
    );

    expect(sasuSyncSendMessage).toHaveBeenCalledWith(
      '+233244000001',
      'Hello',
      undefined,
    );
    expect(termiiSendMessage).not.toHaveBeenCalled();
    expect(piloSendMessage).not.toHaveBeenCalled();
  });

  it('defaults to Termii for backward compatibility', async () => {
    delete process.env.SMS_PROVIDER;

    const service = createService();
    await service.sendOtp('+233244000001', '123456', 'login');

    expect(termiiSendMessage).toHaveBeenCalledWith(
      '+233244000001',
      expect.stringContaining('Your WorkPhelo login code is: 123456'),
      undefined,
    );
    expect(piloSendMessage).not.toHaveBeenCalled();
  });

  it('fails fast for unsupported SMS_PROVIDER values', () => {
    process.env.SMS_PROVIDER = 'other-provider';

    expect(() => createService()).toThrow(
      'Unsupported SMS_PROVIDER "other-provider". Expected "termii", "pilosms", "sasusync", or "agoosms".',
    );
  });

  function createService(): SmsService {
    return new SmsService(
      termiiProvider as TermiiSmsProvider,
      piloProvider as PiloSmsProvider,
      sasuSyncProvider as SasuSyncSmsProvider,
      agooSmsProvider as AgooSmsProvider,
    );
  }
});

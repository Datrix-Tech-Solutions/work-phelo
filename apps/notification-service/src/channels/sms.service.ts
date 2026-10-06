import { Injectable, Logger } from '@nestjs/common';
import { AgooSmsProvider } from './agoosms-sms.provider';
import { PiloSmsProvider } from './pilosms.provider';
import { SasuSyncSmsProvider } from './sasusync-sms.provider';
import type {
  SmsProvider,
  SmsProviderName,
  SmsSendOptions,
  SmsSendResult,
} from './sms-provider.interface';
import { TermiiSmsProvider } from './termii-sms.provider';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;

  constructor(
    termiiProvider: TermiiSmsProvider,
    piloSmsProvider: PiloSmsProvider,
    sasuSyncProvider: SasuSyncSmsProvider,
    agooSmsProvider: AgooSmsProvider,
  ) {
    const providerName = this.resolveProviderName();

    if (providerName === 'termii') {
      this.provider = termiiProvider;
    } else if (providerName === 'pilosms') {
      this.provider = piloSmsProvider;
    } else if (providerName === 'sasusync') {
      this.provider = sasuSyncProvider;
    } else {
      this.provider = agooSmsProvider;
    }

    this.logger.log(`SMS provider selected: ${this.provider.provider}`);
  }

  async sendMessage(
    to: string,
    message: string,
    options?: SmsSendOptions,
  ): Promise<SmsSendResult> {
    return this.provider.sendMessage(to, message, options);
  }

  async sendOtp(
    to: string,
    otp: string,
    context: string,
  ): Promise<SmsSendResult> {
    return this.sendMessage(
      to,
      `Your WorkPhelo ${context} code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
    );
  }

  private resolveProviderName(): SmsProviderName {
    const provider = (process.env.SMS_PROVIDER ?? 'termii')
      .trim()
      .toLowerCase();

    if (
      provider === 'termii' ||
      provider === 'pilosms' ||
      provider === 'sasusync' ||
      provider === 'agoosms'
    ) {
      return provider;
    }

    throw new Error(
      `Unsupported SMS_PROVIDER "${process.env.SMS_PROVIDER}". Expected "termii", "pilosms", "sasusync", or "agoosms".`,
    );
  }
}

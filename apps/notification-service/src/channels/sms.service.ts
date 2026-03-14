import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl = 'https://api.ng.termii.com/api';

  constructor() {
    this.apiKey = process.env.TERMII_API_KEY || '';
    this.senderId = process.env.TERMII_SENDER_ID || 'WorkPhelo';
  }

  async sendOtp(to: string, otp: string, context: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          from: this.senderId,
          sms: `Your WorkPhelo ${context} code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
          type: 'plain',
          api_key: this.apiKey,
          channel: 'generic',
        }),
      });

      const data: any = await response.json();

      if (!response.ok || data.code !== 'ok') {
        this.logger.error(
          `Termii SMS failed for ${to}: ${JSON.stringify(data)}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}`, error);
      return false;
    }
  }
}

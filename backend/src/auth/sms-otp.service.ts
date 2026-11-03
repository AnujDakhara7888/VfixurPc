import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsOtpService {
  constructor(private config: ConfigService) {}

  isConfigured() {
    return !!(this.config.get<string>('MSG91_AUTH_KEY')?.trim() && this.config.get<string>('MSG91_TEMPLATE_ID')?.trim());
  }

  async send(phone: string, code: string) {
    if (!this.isConfigured()) throw new ServiceUnavailableException('SMS verification is temporarily unavailable. Please contact VfixurPC support.');
    const mobile = phone.replace(/^\+/, '');
    try {
      const result = await axios.post('https://control.msg91.com/api/v5/otp', {}, {
        params: {
          template_id: this.config.get<string>('MSG91_TEMPLATE_ID'),
          mobile,
          otp: code,
          otp_length: 6,
        },
        headers: { authkey: this.config.get<string>('MSG91_AUTH_KEY'), 'content-type': 'application/json' },
        timeout: 8000,
      });
      if (result.data?.type && result.data.type !== 'success') throw new Error('Provider rejected OTP');
    } catch {
      throw new ServiceUnavailableException('We could not send the verification code. Please retry in a moment.');
    }
  }
}

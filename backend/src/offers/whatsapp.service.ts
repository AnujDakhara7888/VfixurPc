import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  constructor(private config: ConfigService) {}

  isConfigured() {
    return !!(
      this.config.get<string>('MSG91_AUTH_KEY')?.trim() &&
      this.config.get<string>('MSG91_WHATSAPP_INTEGRATED_NUMBER')?.trim() &&
      this.config.get<string>('MSG91_WHATSAPP_NAMESPACE')?.trim()
    );
  }

  async sendTemplate(phone: string, templateName: string, language: string, parameters: string[]) {
    if (!this.isConfigured()) throw new ServiceUnavailableException('WhatsApp campaigns are not configured. Add the MSG91 WhatsApp sender and namespace first.');
    const components = Object.fromEntries(parameters.map((value, index) => [
      `body_${index + 1}`,
      { type: 'text', value },
    ]));
    try {
      await axios.post('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        integrated_number: this.config.get<string>('MSG91_WHATSAPP_INTEGRATED_NUMBER'),
        content_type: 'template',
        payload: {
          to_and_components: [{ to: [phone.replace(/^\+/, '')], components }],
          template: {
            name: templateName,
            namespace: this.config.get<string>('MSG91_WHATSAPP_NAMESPACE'),
            language: { code: language, policy: 'deterministic' },
          },
        },
      }, {
        headers: { authkey: this.config.get<string>('MSG91_AUTH_KEY'), accept: 'application/json', 'content-type': 'application/json' },
        timeout: 10000,
      });
    } catch {
      throw new ServiceUnavailableException('MSG91 could not accept the WhatsApp message.');
    }
  }
}

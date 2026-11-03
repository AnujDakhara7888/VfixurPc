import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmailService {
  constructor(private config: ConfigService) {}

  private settings() {
    // Keep existing Resend deployments working unless a provider is explicitly selected.
    const provider = this.config.get<string>('EMAIL_PROVIDER')?.trim().toLowerCase()
      || (this.config.get<string>('BREVO_API_KEY')?.trim() ? 'brevo' : 'resend');
    const key = provider === 'brevo' ? this.config.get<string>('BREVO_API_KEY')
      : provider === 'resend' ? this.config.get<string>('RESEND_API_KEY') : '';
    const from = (this.config.get<string>('EMAIL_FROM') || this.config.get<string>('ADMIN_EMAIL_FROM') || '').trim();
    return { provider, key: key?.trim(), from };
  }

  isConfigured() {
    const { key, from } = this.settings();
    return !!(key && from);
  }

  async send(message: { to: string[]; subject: string; text: string }) {
    const { provider, key, from } = this.settings();
    if (!this.isConfigured() || !message.to.length)
      throw new ServiceUnavailableException('Email sending is not configured.');
    try {
      if (provider === 'brevo') {
        const result = await axios.post('https://api.brevo.com/v3/smtp/email', {
          sender: { email: from, name: this.config.get<string>('EMAIL_FROM_NAME') || 'VfixurPC' },
          to: message.to.map(email => ({ email })), subject: message.subject, textContent: message.text,
        }, { headers: { 'api-key': key }, timeout: 5000 });
        if (!result.data?.messageId) throw new Error('Not accepted');
      } else {
        const result = await axios.post('https://api.resend.com/emails', { from, ...message },
          { headers: { Authorization: 'Bearer ' + key }, timeout: 5000 });
        if (!result.data?.id) throw new Error('Not accepted');
      }
    } catch {
      // Axios errors contain API headers and message bodies, including reset codes.
      throw new ServiceUnavailableException('Email provider did not confirm acceptance.');
    }
  }
}

import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';

export type EmailOtpPurpose = 'registration' | 'login' | 'password-reset' | 'email-change';

const COPY: Record<EmailOtpPurpose, { subject: string; action: string }> = {
  registration: { subject: 'Verify your VfixurPC account', action: 'finish creating your account' },
  login: { subject: 'Your VfixurPC sign-in code', action: 'sign in to your account' },
  'password-reset': { subject: 'Reset your VfixurPC password', action: 'reset your password' },
  'email-change': { subject: 'Verify your new VfixurPC email', action: 'change your account email' },
};

@Injectable()
export class EmailOtpService {
  constructor(private email: EmailService) {}

  isConfigured() {
    return this.email.isConfigured();
  }

  async send(address: string, code: string, purpose: EmailOtpPurpose) {
    const copy = COPY[purpose];
    await this.email.send({
      to: [address],
      subject: copy.subject,
      text: [
        `Your VfixurPC verification code is ${code}.`,
        '',
        `Enter this code to ${copy.action}. It expires in 10 minutes.`,
        'If you did not request this code, you can safely ignore this email.',
        'Never share this code with anyone, including VfixurPC support.',
      ].join('\n'),
    });
  }
}

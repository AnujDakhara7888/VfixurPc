import { EmailOtpService } from './email-otp.service';

describe('EmailOtpService', () => {
  it('sends a purpose-specific code without exposing it outside the email body', async () => {
    const email = { isConfigured: jest.fn(() => true), send: jest.fn(async () => {}) };
    const service = new EmailOtpService(email as any);

    await service.send('customer@example.com', '123456', 'login');

    expect(email.send).toHaveBeenCalledWith({
      to: ['customer@example.com'],
      subject: 'Your VfixurPC sign-in code',
      text: expect.stringContaining('123456'),
    });
  });

  it('reports the underlying transactional email configuration', () => {
    const email = { isConfigured: jest.fn(() => false) };
    expect(new EmailOtpService(email as any).isConfigured()).toBe(false);
  });
});

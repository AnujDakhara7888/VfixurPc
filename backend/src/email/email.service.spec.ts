import { EmailService } from './email.service';
import axios from 'axios';
jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

describe('Transactional email', () => {
  let values: Record<string, string>;
  let service: EmailService;
  const message = { to: ['customer@example.com'], subject: 'Reset password', text: 'Private code' };
  beforeEach(() => {
    jest.resetAllMocks();
    values = { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'secret-test', EMAIL_FROM: 'hriday@vfixurpc.com' };
    service = new EmailService({ get: (key: string) => values[key] } as any);
    (axios.post as jest.Mock).mockResolvedValue({data:{messageId:'accepted',id:'accepted'}});
  });
  it('uses Brevo with a server-side API key and plain-text message', async () => {
    await service.send(message);
    expect(axios.post).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', {
      sender:{email:'hriday@vfixurpc.com',name:'VfixurPC'},to:[{email:'customer@example.com'}],
      subject:message.subject,textContent:message.text,
    }, {headers:{'api-key':'secret-test'},timeout:5000});
  });
  it.each(['BREVO_API_KEY','EMAIL_FROM'])('does not send without %s', async field => {
    values[field] = ' ';
    expect(service.isConfigured()).toBe(false);
    await expect(service.send(message)).rejects.toThrow('not configured');
    expect(axios.post).not.toHaveBeenCalled();
  });
  it('does not fall back when the selected provider is missing a key', () => {
    values.BREVO_API_KEY = ''; values.RESEND_API_KEY = 'legacy';
    expect(service.isConfigured()).toBe(false);
  });
  it('rejects an unsupported provider', () => {
    values.EMAIL_PROVIDER = 'invalid';
    expect(service.isConfigured()).toBe(false);
  });
  it('supports an existing Resend deployment unchanged', async () => {
    values = { RESEND_API_KEY:'legacy', ADMIN_EMAIL_FROM:'VfixurPC <hriday@vfixurpc.com>' };
    await service.send(message);
    expect(axios.post).toHaveBeenCalledWith('https://api.resend.com/emails', {
      from:values.ADMIN_EMAIL_FROM,...message,
    }, {headers:{Authorization:'Bearer legacy'},timeout:5000});
  });
  it('selects Brevo automatically when only its key is supplied', async () => {
    delete values.EMAIL_PROVIDER;
    await service.send(message);
    expect((axios.post as jest.Mock).mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
  });
  it.each([401,429,500])('redacts provider error %s and does not retry or switch providers', async status => {
    (axios.post as jest.Mock).mockRejectedValue({status,config:{headers:{'api-key':'secret-test'},data:message}});
    await expect(service.send(message)).rejects.toThrow('Email provider did not confirm acceptance.');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
  it('does not claim acceptance if the response has no message ID', async () => {
    (axios.post as jest.Mock).mockResolvedValue({data:{}});
    await expect(service.send(message)).rejects.toThrow('did not confirm acceptance');
  });
});

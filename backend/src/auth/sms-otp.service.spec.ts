import axios from 'axios';
import { SmsOtpService } from './sms-otp.service';

jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

describe('SmsOtpService', () => {
  const values: Record<string, string> = { MSG91_AUTH_KEY: 'auth-key', MSG91_TEMPLATE_ID: 'template-id' };
  const config: any = { get: (key: string) => values[key] };
  const service = new SmsOtpService(config);

  beforeEach(() => {
    jest.clearAllMocks();
    values.MSG91_AUTH_KEY = 'auth-key';
    values.MSG91_TEMPLATE_ID = 'template-id';
    (axios.post as jest.Mock).mockResolvedValue({ data: { type: 'success' } });
  });

  it('sends a six-digit OTP through the configured MSG91 template', async () => {
    await service.send('+919876543210', '123456');
    expect(axios.post).toHaveBeenCalledWith(
      'https://control.msg91.com/api/v5/otp',
      {},
      expect.objectContaining({
        params: expect.objectContaining({ template_id: 'template-id', mobile: '919876543210', otp: '123456', otp_length: 6 }),
        headers: expect.objectContaining({ authkey: 'auth-key' }),
      }),
    );
  });

  it('fails closed when credentials are missing', async () => {
    values.MSG91_AUTH_KEY = '';
    await expect(service.send('+919876543210', '123456')).rejects.toThrow('temporarily unavailable');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('does not expose provider errors to the customer', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('private provider response'));
    await expect(service.send('+919876543210', '123456')).rejects.toThrow('could not send');
  });
});

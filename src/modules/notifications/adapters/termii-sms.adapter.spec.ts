import notificationsConfig from '../../../config/notifications.config';
import { NotificationChannel } from '../notification.contract';
import { TermiiSmsAdapter } from './termii-sms.adapter';

describe('TermiiSmsAdapter', () => {
  const request = jest.fn();
  const config = notificationsConfig();
  const input = {
    channels: [NotificationChannel.SMS],
    recipient: { phone: '+2348012345678' },
    title: 'Hello',
    body: 'Welcome',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(config.termii, {
      enabled: true,
      baseUrl: 'https://account.termii.com/',
      apiKey: 'test-key',
      senderId: 'Example',
      channel: 'dnd',
    });
  });

  it('uses the account base URL, strips +, and posts the documented payload', async () => {
    request.mockResolvedValue({ code: 'ok', message_id: 'message-id' });
    const adapter = new TermiiSmsAdapter(config, {
      request,
    });
    expect(await adapter.send(input)).toBe('message-id');
    expect(request).toHaveBeenCalledWith(
      'Termii',
      'https://account.termii.com/api/sms/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          api_key: 'test-key',
          to: '2348012345678',
          from: 'Example',
          sms: 'Welcome',
          type: 'plain',
          channel: 'dnd',
        }),
      }),
      10000,
    );
  });

  it('rejects provider-level errors even when HTTP succeeded', async () => {
    request.mockResolvedValue({
      code: 'failed',
      message: 'Credentials included here',
    });
    const adapter = new TermiiSmsAdapter(config, {
      request,
    });
    await expect(adapter.send(input)).rejects.toThrow(
      'Termii did not accept message',
    );
  });

  it('does not contact a disabled provider', async () => {
    config.termii.enabled = false;
    const adapter = new TermiiSmsAdapter(config, {
      request,
    });
    await expect(adapter.send(input)).rejects.toThrow(
      'Termii is not configured',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it.each([null, {}, { code: 'ok', message_id: 123 }])(
    'rejects malformed provider responses: %j',
    async (response) => {
      request.mockResolvedValue(response);
      await expect(
        new TermiiSmsAdapter(config, { request }).send(input),
      ).rejects.toThrow('Termii did not accept message');
    },
  );
});

import { createTransport } from 'nodemailer';
import notificationsConfig from '../../../config/notifications.config';
import { NotificationChannel } from '../notification.contract';
import { SmtpEmailAdapter } from './smtp-email.adapter';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('SmtpEmailAdapter', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  const config = notificationsConfig();
  const input = {
    channels: [NotificationChannel.EMAIL],
    recipient: { email: 'to@example.com' },
    title: 'Hello',
    body: 'Text',
    html: '<p>Text</p>',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(config.smtp, {
      enabled: true,
      host: 'smtp.example.com',
      from: 'from@example.com',
      user: 'user',
      password: 'password',
    });
    jest
      .mocked(createTransport)
      .mockReturnValue({ sendMail, close } as unknown as ReturnType<
        typeof createTransport
      >);
    sendMail.mockResolvedValue({
      messageId: 'mail-id',
      accepted: ['to@example.com'],
      rejected: [],
    });
  });

  it('sends text and HTML with SMTP, requires TLS, and reuses the transport', async () => {
    const adapter = new SmtpEmailAdapter(config);
    await expect(adapter.send(input)).resolves.toBe('mail-id');
    await adapter.send(input);
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Hello',
      text: 'Text',
      html: '<p>Text</p>',
    });
    adapter.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected recipient as a failure', async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: ['to@example.com'] });
    await expect(new SmtpEmailAdapter(config).send(input)).rejects.toThrow(
      'SMTP did not accept recipient',
    );
  });

  it('does not connect when SMTP is disabled', async () => {
    config.smtp.enabled = false;
    await expect(new SmtpEmailAdapter(config).send(input)).rejects.toThrow(
      'SMTP is not configured',
    );
    expect(createTransport).not.toHaveBeenCalled();
  });
});

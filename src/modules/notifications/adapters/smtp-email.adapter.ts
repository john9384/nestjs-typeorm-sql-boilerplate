import {
  Inject,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import notificationsConfig from '../../../config/notifications.config';
import {
  NotificationAdapter,
  NotificationChannel,
  NotificationRequest,
} from '../notification.contract';

@Injectable()
export class SmtpEmailAdapter implements NotificationAdapter, OnModuleDestroy {
  readonly channel = NotificationChannel.EMAIL;
  private transporter?: Transporter;

  constructor(
    @Inject(notificationsConfig.KEY)
    private readonly config: ConfigType<typeof notificationsConfig>,
  ) {}

  async send(request: NotificationRequest): Promise<string> {
    const smtp = this.config.smtp;
    if (!smtp.enabled || !smtp.host || !smtp.from) {
      throw new ServiceUnavailableException('SMTP is not configured');
    }
    this.transporter ??= createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: smtp.requireTLS,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      connectionTimeout: smtp.timeoutMs,
      greetingTimeout: smtp.timeoutMs,
      socketTimeout: smtp.timeoutMs,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const result = await this.transporter.sendMail({
      from: smtp.from,
      to: request.recipient.email,
      subject: request.title,
      text: request.body,
      html: request.html,
    });
    if (!result.accepted?.length || result.rejected?.length) {
      throw new Error('SMTP did not accept recipient');
    }
    return result.messageId;
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }
}

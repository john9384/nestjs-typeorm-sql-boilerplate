import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import notificationsConfig from '../../../config/notifications.config';
import { ProviderHttpClient } from '../../../common/http/provider-http.client';
import {
  NotificationAdapter,
  NotificationChannel,
  NotificationRequest,
} from '../notification.contract';

@Injectable()
export class TermiiSmsAdapter implements NotificationAdapter {
  readonly channel = NotificationChannel.SMS;

  constructor(
    @Inject(notificationsConfig.KEY)
    private readonly config: ConfigType<typeof notificationsConfig>,
    private readonly http: ProviderHttpClient,
  ) {}

  async send(request: NotificationRequest): Promise<string> {
    const termii = this.config.termii;
    if (
      !termii.enabled ||
      !termii.apiKey ||
      !termii.senderId ||
      !termii.baseUrl
    ) {
      throw new ServiceUnavailableException('Termii is not configured');
    }
    const response = await this.http.request<{
      code?: string;
      message_id?: string;
      message_id_str?: string;
    }>(
      'Termii',
      `${termii.baseUrl.replace(/\/$/, '')}/api/sms/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: termii.apiKey,
          to: request.recipient.phone?.replace(/^\+/, ''),
          from: termii.senderId,
          sms: request.body,
          type: 'plain',
          channel: termii.channel,
        }),
      },
      termii.timeoutMs,
    );
    const id = response?.message_id_str || response?.message_id;
    if (response?.code !== 'ok' || typeof id !== 'string' || !id) {
      throw new BadGatewayException('Termii did not accept message');
    }
    return id;
  }
}

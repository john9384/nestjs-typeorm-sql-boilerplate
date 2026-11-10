export const NOTIFICATION_SEND = 'notification.send';
export const NOTIFICATION_ADAPTERS = Symbol('NOTIFICATION_ADAPTERS');

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export interface NotificationRequest {
  channels: NotificationChannel[];
  recipient: { userId?: string; email?: string; phone?: string };
  title: string;
  body: string;
  html?: string;
  data?: Record<string, unknown>;
}

export interface NotificationDelivery {
  channel: NotificationChannel;
  status: 'sent' | 'failed';
  messageId?: string;
  error?: string;
}

export interface NotificationAdapter {
  readonly channel: NotificationChannel;
  send(request: NotificationRequest): Promise<string | undefined>;
}

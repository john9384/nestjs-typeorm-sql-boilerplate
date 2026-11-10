import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NOTIFICATION_SEND } from './notification.contract';
import type { NotificationRequest } from './notification.contract';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(NOTIFICATION_SEND, { suppressErrors: false })
  handleSend(request: NotificationRequest) {
    return this.notifications.send(request);
  }
}

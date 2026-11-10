import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../entities/notification.entity';
import {
  NotificationAdapter,
  NotificationChannel,
  NotificationRequest,
} from '../notification.contract';

@Injectable()
export class InAppAdapter implements NotificationAdapter {
  readonly channel = NotificationChannel.IN_APP;

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repository: Repository<NotificationEntity>,
  ) {}

  async send(request: NotificationRequest): Promise<string> {
    const notification = await this.repository.save(
      this.repository.create({
        userId: request.recipient.userId,
        title: request.title,
        body: request.body,
        data: request.data ?? null,
      }),
    );
    return notification.id;
  }
}

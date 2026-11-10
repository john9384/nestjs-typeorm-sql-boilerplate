import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsNull, Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationEntity } from './entities/notification.entity';
import {
  NOTIFICATION_ADAPTERS,
  NotificationAdapter,
  NotificationChannel,
  NotificationDelivery,
  NotificationRequest,
} from './notification.contract';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATION_ADAPTERS)
    private readonly adapters: NotificationAdapter[],
    @InjectRepository(NotificationEntity)
    private readonly repository: Repository<NotificationEntity>,
  ) {}

  async send(request: NotificationRequest): Promise<NotificationDelivery[]> {
    const dto = plainToInstance(SendNotificationDto, request);
    if (
      !dto ||
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    ) {
      throw new BadRequestException('Invalid notification payload');
    }
    const requiredRecipients = {
      [NotificationChannel.EMAIL]: dto.recipient.email,
      [NotificationChannel.SMS]: dto.recipient.phone,
      [NotificationChannel.IN_APP]: dto.recipient.userId,
    };
    if (dto.channels.some((channel) => !requiredRecipients[channel])) {
      throw new BadRequestException('Missing recipient for requested channel');
    }

    return Promise.all(
      dto.channels.map(async (channel): Promise<NotificationDelivery> => {
        try {
          const adapter = this.adapters.find(
            (candidate) => candidate.channel === channel,
          );
          if (!adapter) throw new Error('Unsupported channel');
          const messageId = await adapter.send(dto);
          return { channel, status: 'sent', messageId };
        } catch {
          // Provider errors can include credentials, message bodies, or recipients.
          this.logger.warn(
            `Notification delivery failed for channel ${channel}`,
          );
          return {
            channel,
            status: 'failed',
            error: `${channel} delivery failed`,
          };
        }
      }),
    );
  }

  async list(userId: string, { page, limit }: PaginationDto) {
    const [items, total] = await this.repository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async markRead(userId: string, id: string): Promise<NotificationEntity> {
    await this.repository.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    const notification = await this.repository.findOneBy({ id, userId });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }
}

import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';
import {
  NotificationChannel,
  NotificationRequest,
} from './notification.contract';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const sendEmail = jest.fn();
  const sendSms = jest.fn();
  const sendInApp = jest.fn();
  const repository = {
    update: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
  };
  let service: NotificationsService;
  let warn: jest.SpyInstance;
  const request: NotificationRequest = {
    channels: [
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.IN_APP,
    ],
    recipient: {
      email: 'test@example.com',
      phone: '+2348012345678',
      userId: '23c4e071-ec94-446e-af55-b8552f33f00b',
    },
    title: 'Welcome',
    body: 'Your account is ready',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    sendEmail.mockResolvedValue('email-id');
    sendSms.mockResolvedValue('sms-id');
    sendInApp.mockResolvedValue('in-app-id');
    service = new NotificationsService(
      [
        { channel: NotificationChannel.EMAIL, send: sendEmail },
        { channel: NotificationChannel.SMS, send: sendSms },
        { channel: NotificationChannel.IN_APP, send: sendInApp },
      ],
      repository as unknown as Repository<NotificationEntity>,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends through every requested channel and returns message ids', async () => {
    expect(await service.send(request)).toEqual([
      { channel: 'email', status: 'sent', messageId: 'email-id' },
      { channel: 'sms', status: 'sent', messageId: 'sms-id' },
      { channel: 'in_app', status: 'sent', messageId: 'in-app-id' },
    ]);
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ body: request.body }),
    );
  });

  it('isolates channel failures and redacts provider errors', async () => {
    sendSms.mockRejectedValue(new Error('secret-api-key recipient-phone'));
    const results = await service.send(request);
    expect(results.map((result) => result.status)).toEqual([
      'sent',
      'failed',
      'sent',
    ]);
    expect(JSON.stringify(results)).not.toContain('secret-api-key');
    expect(warn).toHaveBeenCalledWith(
      'Notification delivery failed for channel sms',
    );
  });

  it.each([
    { channels: [] },
    { channels: ['push'] },
    { channels: [NotificationChannel.EMAIL, NotificationChannel.EMAIL] },
    { recipient: {} },
    { recipient: { email: 'invalid' } },
    { recipient: { phone: '08012345678' } },
    { recipient: { userId: 'invalid' } },
    { title: '' },
    { unexpected: true },
  ])('rejects invalid events before any delivery: %j', async (override) => {
    await expect(
      service.send({ ...request, ...override } as NotificationRequest),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(sendInApp).not.toHaveBeenCalled();
  });

  it('bounds and scopes inbox queries to the authenticated user', async () => {
    repository.findAndCount.mockResolvedValue([[], 0]);
    await expect(
      service.list('user-id', { page: 2, limit: 10 }),
    ).resolves.toEqual({ items: [], total: 0, page: 2, limit: 10 });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-id' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('does not reveal another user’s notification', async () => {
    repository.findOneBy.mockResolvedValue(null);
    await expect(
      service.markRead('user-id', 'notification-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOneBy).toHaveBeenCalledWith({
      id: 'notification-id',
      userId: 'user-id',
    });
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notification-id', userId: 'user-id' }),
      expect.any(Object),
    );
  });
});

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import notificationsConfig from '../../config/notifications.config';
import { ProviderHttpClient } from '../../common/http/provider-http.client';
import { GuardsModule } from '../../common/guards/guards.module';
import { InAppAdapter } from './adapters/in-app.adapter';
import { SmtpEmailAdapter } from './adapters/smtp-email.adapter';
import { TermiiSmsAdapter } from './adapters/termii-sms.adapter';
import { NotificationEntity } from './entities/notification.entity';
import { NOTIFICATION_ADAPTERS } from './notification.contract';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    ConfigModule.forFeature(notificationsConfig),
    TypeOrmModule.forFeature([NotificationEntity]),
    GuardsModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsListener,
    ProviderHttpClient,
    SmtpEmailAdapter,
    TermiiSmsAdapter,
    InAppAdapter,
    {
      provide: NOTIFICATION_ADAPTERS,
      useFactory: (
        email: SmtpEmailAdapter,
        sms: TermiiSmsAdapter,
        inApp: InAppAdapter,
      ) => [email, sms, inApp],
      inject: [SmtpEmailAdapter, TermiiSmsAdapter, InAppAdapter],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

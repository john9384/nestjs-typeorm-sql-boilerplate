import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import paymentsConfig from '../../config/payments.config';
import { GuardsModule } from '../../common/guards/guards.module';
import { ProviderHttpClient } from '../../common/http/provider-http.client';
import { PaystackAdapter } from './adapters/paystack.adapter';
import { PaymentEntity } from './entities/payment.entity';
import { PAYMENT_ADAPTERS } from './payment.contract';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    ConfigModule.forFeature(paymentsConfig),
    TypeOrmModule.forFeature([PaymentEntity]),
    GuardsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    ProviderHttpClient,
    PaystackAdapter,
    {
      provide: PAYMENT_ADAPTERS,
      useFactory: (paystack: PaystackAdapter) => [paystack],
      inject: [PaystackAdapter],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}

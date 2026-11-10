import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { DataSource, Repository } from 'typeorm';
import paymentsConfig from '../../config/payments.config';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentEntity } from './entities/payment.entity';
import {
  InitializePayment,
  PAYMENT_ADAPTERS,
  PAYMENT_SUCCEEDED,
  PaymentAdapter,
  PaymentSucceededEvent,
} from './payment.contract';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_ADAPTERS) private readonly adapters: PaymentAdapter[],
    @Inject(paymentsConfig.KEY)
    private readonly config: ConfigType<typeof paymentsConfig>,
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async initialize(input: InitializePayment): Promise<PaymentEntity> {
    const request = plainToInstance(InitializePaymentDto, input);
    if (
      !request ||
      (await validate(request, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    ) {
      throw new BadRequestException('Invalid payment payload');
    }
    const adapter = this.adapter(request.provider || this.config.provider);
    const currency = request.currency || this.config.currency;
    const reference = randomUUID();
    // Save intent before contacting the provider so an early webhook can find it.
    const payment = await this.repository.save(
      this.repository.create({
        userId: request.userId,
        email: request.email,
        amount: String(request.amount),
        currency,
        reference,
        provider: adapter.name,
        status: 'pending',
        metadata: request.metadata ?? null,
      }),
    );
    // Leave timed-out requests pending: the provider may have accepted them.
    const initialized = await adapter.initialize({
      ...request,
      reference,
      currency,
    });
    if (initialized.reference !== reference)
      throw new BadGatewayException('Payment reference mismatch');
    // Only update checkout fields; never overwrite status changed by a concurrent webhook.
    await this.repository.update(payment.id, {
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
    });
    return this.repository.findOneByOrFail({ id: payment.id });
  }

  async verifyForUser(
    reference: string,
    userId: string,
  ): Promise<PaymentEntity> {
    const payment = await this.repository.findOneBy({ reference, userId });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.verify(payment);
  }

  async handleWebhook(
    provider: string,
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
  ) {
    const reference = this.adapter(provider).parseWebhook(rawBody, headers);
    if (!reference) return { received: true };
    const payment = await this.repository.findOneBy({ reference, provider });
    // A provider account can also have payments initiated outside this application.
    if (payment) await this.verify(payment);
    return { received: true };
  }

  private async verify(payment: PaymentEntity): Promise<PaymentEntity> {
    if (payment.status === 'success') return payment;
    const verified = await this.adapter(payment.provider).verify(
      payment.reference,
    );
    if (
      verified.reference !== payment.reference ||
      verified.amount !== Number(payment.amount) ||
      verified.currency !== payment.currency
    ) {
      throw new BadGatewayException(
        'Payment verification does not match stored intent',
      );
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentEntity);
      const current = await repository.findOneOrFail({
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (current.status === 'success')
        return { payment: current, succeeded: false };
      current.status = verified.status;
      current.paidAt = verified.status === 'success' ? verified.paidAt : null;
      return {
        payment: await repository.save(current),
        succeeded: verified.status === 'success',
      };
    });

    if (result.succeeded) {
      const event: PaymentSucceededEvent = {
        id: result.payment.id,
        userId: result.payment.userId,
        reference: result.payment.reference,
        provider: result.payment.provider,
        amount: Number(result.payment.amount),
        currency: result.payment.currency,
        metadata: result.payment.metadata,
      };
      // Listeners run after commit, so they see the final state.
      try {
        await this.events.emitAsync(PAYMENT_SUCCEEDED, event);
      } catch {
        this.logger.error(
          `Payment success listener failed for ${result.payment.id}`,
        );
      }
    }
    return result.payment;
  }

  private adapter(name: string): PaymentAdapter {
    const adapter = this.adapters.find((candidate) => candidate.name === name);
    if (!adapter)
      throw new BadRequestException(`Unsupported payment provider: ${name}`);
    return adapter;
  }
}

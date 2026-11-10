import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID, createHmac } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import paymentsConfig from '../src/config/payments.config';
import { SmtpEmailAdapter } from '../src/modules/notifications/adapters/smtp-email.adapter';
import { ProviderHttpClient } from '../src/common/http/provider-http.client';
import { UserEntity } from '../src/database/entities/user.entity';
import { NotificationEntity } from '../src/modules/notifications/entities/notification.entity';
import {
  NOTIFICATION_SEND,
  NotificationChannel,
  NotificationDelivery,
} from '../src/modules/notifications/notification.contract';
import { PaymentEntity } from '../src/modules/payments/entities/payment.entity';
import { PaystackAdapter } from '../src/modules/payments/adapters/paystack.adapter';
import {
  PAYMENT_ADAPTERS,
  PAYMENT_SUCCEEDED,
} from '../src/modules/payments/payment.contract';
import type { PaymentAdapter } from '../src/modules/payments/payment.contract';
import { PaymentsService } from '../src/modules/payments/payments.service';

/** Run against a disposable migrated PostgreSQL database. External requests are mocked. */
describe('Application integrations (e2e)', () => {
  let app: INestApplication<App>;
  let events: EventEmitter2;
  let payments: PaymentsService;
  let users: Repository<UserEntity>;
  let inbox: Repository<NotificationEntity>;
  let transactions: Repository<PaymentEntity>;
  let user: UserEntity;
  let otherUser: UserEntity;
  let token: string;
  let otherToken: string;
  const providerTransactions = new Map<
    string,
    {
      reference: string;
      amount: number;
      currency: string;
      status: string;
      paid_at: string | null;
    }
  >();
  const providerRequest = jest.fn(
    (_provider: string, url: string, options: RequestInit) => {
      if (url.endsWith('/transaction/initialize')) {
        const payload = JSON.parse(options.body as string) as {
          reference: string;
          amount: string;
          currency: string;
        };
        providerTransactions.set(payload.reference, {
          reference: payload.reference,
          amount: Number(payload.amount),
          currency: payload.currency,
          status: 'pending',
          paid_at: null,
        });
        return Promise.resolve({
          status: true,
          data: {
            reference: payload.reference,
            authorization_url: `https://checkout.paystack.com/${payload.reference}`,
            access_code: 'checkout-code',
          },
        });
      }
      const reference = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));
      return Promise.resolve({
        status: true,
        data: providerTransactions.get(reference),
      });
    },
  );
  const succeeded = jest.fn();
  const alternative: PaymentAdapter = {
    name: 'alternative',
    initialize: (input) =>
      Promise.resolve({
        reference: input.reference,
        authorizationUrl: 'https://alternative.example/checkout',
        accessCode: 'alternative-code',
      }),
    verify: (reference) =>
      Promise.resolve({
        reference,
        amount: 1000,
        currency: 'NGN',
        status: 'success',
        paidAt: new Date(),
      }),
    parseWebhook: () => null,
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProviderHttpClient)
      .useValue({ request: providerRequest })
      .overrideProvider(SmtpEmailAdapter)
      .useValue({
        channel: NotificationChannel.EMAIL,
        send: jest.fn().mockRejectedValue(new Error('Simulated SMTP failure')),
      })
      .overrideProvider(paymentsConfig.KEY)
      .useValue({
        provider: 'paystack',
        currency: 'NGN',
        paystack: {
          secretKey: 'sk_test_e2e',
          webhookSecret: undefined,
          baseUrl: 'https://api.paystack.co',
          timeoutMs: 10000,
        },
      })
      .overrideProvider(PAYMENT_ADAPTERS)
      .useFactory({
        factory: (paystack: PaystackAdapter) => [paystack, alternative],
        inject: [PaystackAdapter],
      })
      .compile();
    app = module.createNestApplication<INestApplication<App>>({
      rawBody: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    events = app.get(EventEmitter2);
    payments = app.get(PaymentsService);
    users = app.get(getRepositoryToken(UserEntity));
    inbox = app.get(getRepositoryToken(NotificationEntity));
    transactions = app.get(getRepositoryToken(PaymentEntity));
    const email = `test-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Test User', email, password: 'test-password' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'test-password' })
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;
    user = await users.findOneByOrFail({ email });
    const otherEmail = `test-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Other User',
        email: otherEmail,
        password: 'test-password',
      })
      .expect(201);
    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password: 'test-password' })
      .expect(200);
    otherToken = (otherLogin.body as { accessToken: string }).accessToken;
    otherUser = await users.findOneByOrFail({ email: otherEmail });
    events.on(PAYMENT_SUCCEEDED, succeeded);
  });

  afterAll(async () => {
    if (!app) return;
    events?.off(PAYMENT_SUCCEEDED, succeeded);
    for (const account of [user, otherUser]) {
      if (!account) continue;
      await transactions.delete({ userId: account.id });
      await inbox.delete({ userId: account.id });
      await users.delete(account.id);
    }
    await app.close();
  });

  it('serves the root route', () =>
    request(app.getHttpServer()).get('/').expect(200).expect('Hello World!'));

  it('requires authentication for inbox and payment verification', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
    await request(app.getHttpServer())
      .patch(`/notifications/${randomUUID()}/read`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/payments/unknown/verify')
      .expect(401);
  });

  it('delivers event-driven in-app notifications and isolates disabled SMTP', async () => {
    const [deliveries] = (await events.emitAsync(NOTIFICATION_SEND, {
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipient: { email: user.email, userId: user.id },
      title: 'Welcome',
      body: 'Your inbox is ready',
      data: { route: '/dashboard' },
    })) as NotificationDelivery[][];
    expect(deliveries.map((delivery) => delivery.status)).toEqual([
      'failed',
      'sent',
    ]);
    const response = await request(app.getHttpServer())
      .get('/notifications?page=1&limit=5')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const body = response.body as {
      items: NotificationEntity[];
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      userId: user.id,
      title: 'Welcome',
      data: { route: '/dashboard' },
      readAt: null,
    });
    const notificationId = body.items[0].id;
    await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404);
    const read = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    const readAgain = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/read`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((read.body as NotificationEntity).readAt).toBeTruthy();
    expect((readAgain.body as NotificationEntity).readAt).toBe(
      (read.body as NotificationEntity).readAt,
    );
    const otherInbox = await request(app.getHttpServer())
      .get('/notifications')
      .auth(otherToken, { type: 'bearer' })
      .expect(200);
    expect((otherInbox.body as { total: number }).total).toBe(0);
  });

  it('rejects invalid event payloads and invalid pagination', async () => {
    await expect(
      events.emitAsync(NOTIFICATION_SEND, {
        channels: ['email'],
        recipient: {},
        title: 'Hello',
        body: 'Text',
      }),
    ).rejects.toThrow('Missing recipient');
    await request(app.getHttpServer())
      .get('/notifications?limit=101')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/notifications/invalid/read')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });

  it('initializes a payment for use by trusted business services', async () => {
    const payment = await payments.initialize({
      userId: user.id,
      email: user.email,
      amount: 10000,
      metadata: { orderId: 'example-order' },
    });
    expect(payment).toMatchObject({
      amount: '10000',
      currency: 'NGN',
      provider: 'paystack',
      status: 'pending',
      accessCode: 'checkout-code',
    });
    expect(payment.authorizationUrl).toContain('checkout.paystack.com');
    await request(app.getHttpServer())
      .get(`/payments/${payment.reference}/verify`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404);
    const pending = await payments.verifyForUser(payment.reference, user.id);
    expect(pending.status).toBe('pending');
  });

  it('validates internal payment inputs and provider selection', async () => {
    await expect(
      payments.initialize({ userId: user.id, email: user.email, amount: 1.5 }),
    ).rejects.toThrow('Invalid payment payload');
    await expect(
      payments.initialize({
        userId: user.id,
        email: user.email,
        amount: 100,
        provider: 'unknown',
      }),
    ).rejects.toThrow('Unsupported payment provider');
  });

  it('uses an alternative adapter through the same service contract', async () => {
    const payment = await payments.initialize({
      userId: user.id,
      email: user.email,
      amount: 1000,
      provider: 'alternative',
    });
    expect(payment.provider).toBe('alternative');
    expect(payment.authorizationUrl).toBe(
      'https://alternative.example/checkout',
    );
    expect(
      (await payments.verifyForUser(payment.reference, user.id)).status,
    ).toBe('success');
    expect(providerTransactions.has(payment.reference)).toBe(false);
  });

  it('keeps the stored intent pending when provider initialization times out', async () => {
    providerRequest.mockRejectedValueOnce(new Error('Simulated timeout'));
    await expect(
      payments.initialize({
        userId: user.id,
        email: user.email,
        amount: 31415,
      }),
    ).rejects.toThrow('Simulated timeout');
    const intent = await transactions.findOneByOrFail({
      userId: user.id,
      amount: '31415',
    });
    expect(intent.status).toBe('pending');
    expect(intent.authorizationUrl).toBeNull();
  });

  it('rejects amount, currency, and reference mismatches without marking a payment successful', async () => {
    const payment = await payments.initialize({
      userId: user.id,
      email: user.email,
      amount: 20000,
    });
    const remote = providerTransactions.get(payment.reference)!;
    remote.status = 'success';
    remote.amount = 1;
    await expect(
      payments.verifyForUser(payment.reference, user.id),
    ).rejects.toThrow('does not match stored intent');
    remote.amount = 20000;
    remote.currency = 'USD';
    await expect(
      payments.verifyForUser(payment.reference, user.id),
    ).rejects.toThrow('does not match stored intent');
    remote.currency = 'NGN';
    remote.reference = 'wrong-reference';
    await expect(
      payments.verifyForUser(payment.reference, user.id),
    ).rejects.toThrow('Invalid Paystack verification response');
    expect(
      (await transactions.findOneByOrFail({ id: payment.id })).status,
    ).toBe('pending');
  });

  it('rejects forged webhooks and authenticates the raw request body', async () => {
    await request(app.getHttpServer())
      .post('/payments/webhooks/paystack')
      .send({ event: 'charge.success' })
      .expect(401);
    const payload = '{ "event": "transfer.success", "data": {} }';
    const signature = createHmac('sha512', 'sk_test_e2e')
      .update(payload)
      .digest('hex');
    await request(app.getHttpServer())
      .post('/payments/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(payload)
      .expect(200);
    await request(app.getHttpServer())
      .post('/payments/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .send({ event: 'transfer.success', data: {} })
      .expect(401);
  });

  it('handles concurrent webhook retries and verification with one success event', async () => {
    succeeded.mockClear();
    const payment = await payments.initialize({
      userId: user.id,
      email: user.email,
      amount: 50000,
      metadata: { orderId: 'paid-order' },
    });
    const remote = providerTransactions.get(payment.reference)!;
    remote.status = 'success';
    remote.paid_at = new Date().toISOString();
    const payload = JSON.stringify({
      event: 'charge.success',
      data: { reference: payment.reference },
    });
    const signature = createHmac('sha512', 'sk_test_e2e')
      .update(payload)
      .digest('hex');
    await Promise.all([
      request(app.getHttpServer())
        .post('/payments/webhooks/paystack')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', signature)
        .send(payload)
        .expect(200),
      request(app.getHttpServer())
        .post('/payments/webhooks/paystack')
        .set('Content-Type', 'application/json')
        .set('x-paystack-signature', signature)
        .send(payload)
        .expect(200),
      request(app.getHttpServer())
        .get(`/payments/${payment.reference}/verify`)
        .auth(token, { type: 'bearer' })
        .expect(200),
    ]);
    expect(succeeded).toHaveBeenCalledTimes(1);
    expect(succeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: payment.reference,
        userId: user.id,
        amount: 50000,
        currency: 'NGN',
        metadata: { orderId: 'paid-order' },
      }),
    );
    expect(
      (await transactions.findOneByOrFail({ id: payment.id })).status,
    ).toBe('success');
    remote.status = 'pending';
    expect(
      (await payments.verifyForUser(payment.reference, user.id)).status,
    ).toBe('success');
    expect(succeeded).toHaveBeenCalledTimes(1);
  });
});

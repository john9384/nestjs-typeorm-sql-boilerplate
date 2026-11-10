import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import paymentsConfig from '../../../config/payments.config';
import { PaystackAdapter } from './paystack.adapter';

describe('PaystackAdapter', () => {
  const http = { request: jest.fn() };
  let config: ReturnType<typeof paymentsConfig>;
  let adapter: PaystackAdapter;
  const rawBody = Buffer.from(
    '{ "event": "charge.success", "data": {"reference":"ref-123"} }',
  );

  beforeEach(() => {
    jest.resetAllMocks();
    config = {
      provider: 'paystack',
      currency: 'NGN',
      paystack: {
        secretKey: 'sk_test_secret',
        webhookSecret: undefined,
        baseUrl: 'https://api.paystack.co',
        callbackUrl: 'https://example.com/callback',
        timeoutMs: 10000,
      },
    };
    adapter = new PaystackAdapter(config, http);
  });

  const legacySignature = (body: Buffer) =>
    createHmac('sha512', 'sk_test_secret').update(body).digest('hex');
  const modernSignature = (body: Buffer, timestamp: number) =>
    `t=${timestamp},v1=whk_test:${createHmac('sha512', 'whsec_test').update(`${timestamp}.`).update(body).digest('hex')}`;

  it('authenticates legacy signatures using exact raw bytes', () => {
    expect(
      adapter.parseWebhook(rawBody, {
        'x-paystack-signature': legacySignature(rawBody),
      }),
    ).toBe('ref-123');
    expect(() =>
      adapter.parseWebhook(Buffer.from('{}'), {
        'x-paystack-signature': legacySignature(rawBody),
      }),
    ).toThrow(UnauthorizedException);
  });

  it.each([undefined, 'bad', 'a'.repeat(128), 'a'.repeat(127)])(
    'rejects missing or invalid signatures: %s',
    (signature) => {
      expect(() =>
        adapter.parseWebhook(rawBody, { 'x-paystack-signature': signature }),
      ).toThrow(UnauthorizedException);
    },
  );

  it('authenticates timestamped signatures and handles rotation entries', () => {
    config.paystack.webhookSecret = 'whsec_test';
    const signature = modernSignature(rawBody, Math.floor(Date.now() / 1000));
    expect(
      adapter.parseWebhook(rawBody, {
        'paystack-signature': `${signature},v1=whk_old:${'a'.repeat(128)}`,
      }),
    ).toBe('ref-123');
  });

  it('rejects stale signatures and duplicate timestamps', () => {
    config.paystack.webhookSecret = 'whsec_test';
    const now = Math.floor(Date.now() / 1000);
    expect(() =>
      adapter.parseWebhook(rawBody, {
        'paystack-signature': modernSignature(rawBody, now - 301),
      }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      adapter.parseWebhook(rawBody, {
        'paystack-signature': `${modernSignature(rawBody, now)},t=${now}`,
      }),
    ).toThrow(UnauthorizedException);
  });

  it('does not downgrade to legacy verification when a signing secret is configured', () => {
    config.paystack.webhookSecret = 'whsec_test';
    expect(() =>
      adapter.parseWebhook(rawBody, {
        'x-paystack-signature': legacySignature(rawBody),
      }),
    ).toThrow(UnauthorizedException);
  });

  it('ignores authenticated events that are not charge.success', () => {
    const body = Buffer.from('{"event":"transfer.success"}');
    expect(
      adapter.parseWebhook(body, {
        'x-paystack-signature': legacySignature(body),
      }),
    ).toBeNull();
  });

  it.each(['{"event":"charge.success"}', 'invalid-json'])(
    'rejects malformed signed payloads',
    (payload) => {
      const body = Buffer.from(payload);
      expect(() =>
        adapter.parseWebhook(body, {
          'x-paystack-signature': legacySignature(body),
        }),
      ).toThrow(BadRequestException);
    },
  );

  it('initializes with integer subunits and normalizes the checkout response', async () => {
    http.request.mockResolvedValue({
      status: true,
      data: {
        reference: 'ref-123',
        authorization_url: 'https://checkout.paystack.com/code',
        access_code: 'code',
      },
    });
    await expect(
      adapter.initialize({
        userId: 'user',
        email: 'test@example.com',
        amount: 12345,
        currency: 'NGN',
        reference: 'ref-123',
        metadata: { orderId: 'order' },
      }),
    ).resolves.toEqual({
      reference: 'ref-123',
      authorizationUrl: 'https://checkout.paystack.com/code',
      accessCode: 'code',
    });
    expect(http.request).toHaveBeenCalledWith(
      'Paystack',
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'test@example.com',
          amount: '12345',
          currency: 'NGN',
          reference: 'ref-123',
          callback_url: 'https://example.com/callback',
          metadata: JSON.stringify({ orderId: 'order' }),
        }),
      }),
      10000,
    );
  });

  it('encodes references and normalizes verification', async () => {
    http.request.mockResolvedValue({
      status: true,
      data: {
        reference: 'ref/a',
        amount: 100,
        currency: 'NGN',
        status: 'success',
        paid_at: '2026-11-10T12:00:00Z',
      },
    });
    expect(await adapter.verify('ref/a')).toEqual({
      reference: 'ref/a',
      amount: 100,
      currency: 'NGN',
      status: 'success',
      paidAt: new Date('2026-11-10T12:00:00Z'),
    });
    expect(http.request).toHaveBeenCalledWith(
      'Paystack',
      'https://api.paystack.co/transaction/verify/ref%2Fa',
      expect.any(Object),
      10000,
    );
  });

  it('rejects provider failures and mismatched references', async () => {
    http.request.mockResolvedValueOnce({
      status: false,
      message: 'sensitive error',
    });
    await expect(adapter.verify('ref')).rejects.toThrow(
      'Paystack request failed',
    );
    http.request.mockResolvedValueOnce({
      status: true,
      data: { reference: 'other', amount: 100, currency: 'NGN' },
    });
    await expect(adapter.verify('ref')).rejects.toThrow(
      'Invalid Paystack verification response',
    );
  });

  it('rejects a malformed provider envelope', async () => {
    http.request.mockResolvedValue(null);
    await expect(adapter.verify('ref')).rejects.toThrow(
      'Paystack request failed',
    );
  });

  it.each(['javascript:alert(1)', 'https://'])(
    'rejects invalid checkout URLs: %s',
    async (url) => {
      http.request.mockResolvedValue({
        status: true,
        data: { reference: 'ref', authorization_url: url, access_code: 'code' },
      });
      await expect(
        adapter.initialize({
          userId: 'user',
          email: 'test@example.com',
          amount: 100,
          currency: 'NGN',
          reference: 'ref',
        }),
      ).rejects.toThrow('Invalid Paystack initialization response');
    },
  );
});

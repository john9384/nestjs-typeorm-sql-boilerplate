import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import paymentsConfig from '../../../config/payments.config';
import { ProviderHttpClient } from '../../../common/http/provider-http.client';
import {
  InitializePayment,
  PaymentAdapter,
  PaymentInitialization,
  PaymentVerification,
} from '../payment.contract';

@Injectable()
export class PaystackAdapter implements PaymentAdapter {
  readonly name = 'paystack';

  constructor(
    @Inject(paymentsConfig.KEY)
    private readonly config: ConfigType<typeof paymentsConfig>,
    private readonly http: ProviderHttpClient,
  ) {}

  async initialize(
    request: InitializePayment & { reference: string; currency: string },
  ): Promise<PaymentInitialization> {
    const data = await this.request<{
      reference: string;
      authorization_url: string;
      access_code: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: request.email,
        amount: String(request.amount),
        currency: request.currency,
        reference: request.reference,
        callback_url: this.config.paystack.callbackUrl,
        metadata: request.metadata
          ? JSON.stringify(request.metadata)
          : undefined,
      }),
    });
    if (
      data.reference !== request.reference ||
      typeof data.authorization_url !== 'string' ||
      !URL.canParse(data.authorization_url) ||
      !data.authorization_url.startsWith('https://') ||
      typeof data.access_code !== 'string' ||
      !data.access_code
    ) {
      throw new BadGatewayException('Invalid Paystack initialization response');
    }
    return {
      reference: data.reference,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
    };
  }

  async verify(reference: string): Promise<PaymentVerification> {
    const data = await this.request<{
      reference: string;
      amount: number;
      currency: string;
      status: string;
      paid_at: string | null;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
    });
    if (
      data.reference !== reference ||
      !Number.isSafeInteger(data.amount) ||
      data.amount < 1 ||
      !/^[A-Z]{3}$/.test(data.currency)
    ) {
      throw new BadGatewayException('Invalid Paystack verification response');
    }
    const paidAt = data.paid_at ? new Date(data.paid_at) : null;
    if (paidAt && Number.isNaN(paidAt.getTime()))
      throw new BadGatewayException('Invalid Paystack payment date');
    return {
      reference: data.reference,
      amount: data.amount,
      currency: data.currency,
      status:
        data.status === 'success'
          ? 'success'
          : ['failed', 'abandoned', 'reversed'].includes(data.status)
            ? 'failed'
            : 'pending',
      paidAt,
    };
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): string | null {
    if (!Buffer.isBuffer(rawBody))
      throw new UnauthorizedException('Missing webhook body');
    const { webhookSecret, secretKey } = this.config.paystack;
    let valid = false;
    if (webhookSecret) {
      // With a signing secret configured, do not downgrade to the legacy header.
      const header = headers['paystack-signature'];
      if (typeof header === 'string') {
        let timestamp: string | undefined;
        const signatures: string[] = [];
        let duplicateTimestamp = false;
        for (const part of header.split(',')) {
          const separator = part.indexOf('=');
          const key = part.slice(0, separator).trim();
          const value = part.slice(separator + 1).trim();
          if (separator < 0) continue;
          if (key === 't') {
            if (timestamp !== undefined) duplicateTimestamp = true;
            timestamp = value;
          }
          if (key === 'v1' && value.startsWith('whk_'))
            signatures.push(value.slice(value.indexOf(':') + 1));
        }
        if (
          !duplicateTimestamp &&
          timestamp &&
          /^\d+$/.test(timestamp) &&
          Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300
        ) {
          const expected = createHmac('sha512', webhookSecret)
            .update(`${timestamp}.`)
            .update(rawBody)
            .digest();
          valid = signatures.some((signature) =>
            this.matches(expected, signature),
          );
        }
      }
    } else {
      if (!secretKey)
        throw new ServiceUnavailableException('Paystack is not configured');
      const signature = headers['x-paystack-signature'];
      valid =
        typeof signature === 'string' &&
        this.matches(
          createHmac('sha512', secretKey).update(rawBody).digest(),
          signature,
        );
    }
    if (!valid) throw new UnauthorizedException('Invalid webhook signature');

    let payload: { event?: string; data?: { reference?: unknown } };
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
    if (payload?.event !== 'charge.success') return null;
    if (
      typeof payload.data?.reference !== 'string' ||
      !payload.data.reference ||
      payload.data.reference.length > 100
    ) {
      throw new BadRequestException('Invalid webhook reference');
    }
    return payload.data.reference;
  }

  private matches(expected: Buffer, signature: string): boolean {
    return (
      /^[0-9a-f]{128}$/.test(signature) &&
      timingSafeEqual(expected, Buffer.from(signature, 'hex'))
    );
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const { secretKey, baseUrl, timeoutMs } = this.config.paystack;
    if (!secretKey)
      throw new ServiceUnavailableException('Paystack is not configured');
    const response = await this.http.request<{ status: boolean; data: T }>(
      'Paystack',
      `${baseUrl.replace(/\/$/, '')}${path}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      },
      timeoutMs,
    );
    if (response?.status !== true || !response.data)
      throw new BadGatewayException('Paystack request failed');
    return response.data;
  }
}

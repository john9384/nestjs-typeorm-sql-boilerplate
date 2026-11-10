import { registerAs } from '@nestjs/config';

export default registerAs('payments', () => ({
  provider: process.env.PAYMENT_PROVIDER || 'paystack',
  currency: process.env.PAYMENT_CURRENCY || 'NGN',
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    callbackUrl: process.env.PAYSTACK_CALLBACK_URL || undefined,
    timeoutMs: Number(process.env.PAYSTACK_TIMEOUT_MS || 10000),
  },
}));

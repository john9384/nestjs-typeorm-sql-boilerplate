import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { validationSchema } from './validation.schema';
import { databaseOptions } from './database-options';

describe('Configuration', () => {
  const base = {
    POSTGRES_HOST: 'localhost',
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'password',
    POSTGRES_DB: 'test',
    JWT_SECRET: 'test-secret',
  };

  it('accepts env.example with unconfigured external channels', () => {
    const parsed = parse(readFileSync('env.example'));
    expect(validationSchema.validate(parsed).error).toBeUndefined();
  });

  it.each([
    { SMTP_ENABLED: true },
    { SMTP_ENABLED: true, SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'invalid' },
    { SMTP_USER: 'user', SMTP_PASSWORD: '' },
    { TERMII_ENABLED: true },
    { TERMII_TIMEOUT_MS: 0 },
    { PAYMENT_CURRENCY: 'ngn' },
    { PAYSTACK_BASE_URL: 'http://example.com' },
  ])('rejects invalid configuration: %j', (override) => {
    expect(
      validationSchema.validate({ ...base, ...override }).error,
    ).toBeDefined();
  });

  it('enables configured SMTP and Termii channels', () => {
    expect(
      validationSchema.validate({
        ...base,
        SMTP_ENABLED: true,
        SMTP_HOST: 'smtp.example.com',
        SMTP_FROM: 'app@example.com',
        TERMII_ENABLED: true,
        TERMII_API_KEY: 'key',
        TERMII_SENDER_ID: 'Example',
        TERMII_BASE_URL: 'https://example.termii.com',
      }).error,
    ).toBeUndefined();
  });

  it('defaults certificate verification on in verification modes', () => {
    const options = databaseOptions({
      ...base,
      POSTGRES_SSLMODE: 'verify-full',
    });
    expect('ssl' in options && options.ssl).toEqual({
      rejectUnauthorized: true,
    });
  });
});

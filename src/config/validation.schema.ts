import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database configuration
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  // SSL settings using sslmode semantics
  POSTGRES_SSLMODE: Joi.string()
    .valid('disable', 'prefer', 'require', 'verify-ca', 'verify-full')
    .default('disable'),
  POSTGRES_SSL_REJECT_UNAUTHORIZED: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid('true', 'false'))
    .optional(),
  POSTGRES_SSL_CA: Joi.string().optional(),
  POSTGRES_SSL_CERT: Joi.string().optional(),
  POSTGRES_SSL_KEY: Joi.string().optional(),

  // Application configuration
  PORT: Joi.number().port().default(3000),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),

  // Disabled channels do not require credentials; enabling them validates configuration.
  SMTP_ENABLED: Joi.boolean().default(false),
  SMTP_HOST: Joi.string().when('SMTP_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_REQUIRE_TLS: Joi.boolean().default(true),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASSWORD: Joi.when('SMTP_USER', {
    is: Joi.string().min(1).required(),
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow(''),
  }),
  SMTP_FROM: Joi.string()
    .email()
    .when('SMTP_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow(''),
    }),
  SMTP_TIMEOUT_MS: Joi.number().integer().min(100).max(120000).default(10000),

  TERMII_ENABLED: Joi.boolean().default(false),
  TERMII_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .when('TERMII_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow(''),
    }),
  TERMII_API_KEY: Joi.string().when('TERMII_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.allow(''),
  }),
  TERMII_SENDER_ID: Joi.string()
    .alphanum()
    .min(3)
    .max(11)
    .when('TERMII_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow(''),
    }),
  TERMII_CHANNEL: Joi.string().valid('generic', 'dnd').default('dnd'),
  TERMII_TIMEOUT_MS: Joi.number().integer().min(100).max(120000).default(10000),

  PAYMENT_PROVIDER: Joi.string()
    .pattern(/^[a-z][a-z0-9_-]{0,49}$/)
    .default('paystack'),
  PAYMENT_CURRENCY: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .default('NGN'),
  PAYSTACK_SECRET_KEY: Joi.string().allow('').optional(),
  PAYSTACK_WEBHOOK_SECRET: Joi.string()
    .pattern(/^whsec_/)
    .allow('')
    .optional(),
  PAYSTACK_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .default('https://api.paystack.co'),
  PAYSTACK_CALLBACK_URL: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .allow('')
    .optional(),
  PAYSTACK_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(120000)
    .default(10000),
});

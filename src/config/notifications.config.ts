import { registerAs } from '@nestjs/config';

export default registerAs('notifications', () => ({
  smtp: {
    enabled: process.env.SMTP_ENABLED?.toLowerCase() === 'true',
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE?.toLowerCase() === 'true',
    requireTLS: process.env.SMTP_REQUIRE_TLS?.toLowerCase() !== 'false',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
    timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 10000),
  },
  termii: {
    enabled: process.env.TERMII_ENABLED?.toLowerCase() === 'true',
    baseUrl: process.env.TERMII_BASE_URL,
    apiKey: process.env.TERMII_API_KEY,
    senderId: process.env.TERMII_SENDER_ID,
    channel: process.env.TERMII_CHANNEL || 'dnd',
    timeoutMs: Number(process.env.TERMII_TIMEOUT_MS || 10000),
  },
}));

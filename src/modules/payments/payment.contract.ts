import type { IncomingHttpHeaders } from 'node:http';

export const PAYMENT_ADAPTERS = Symbol('PAYMENT_ADAPTERS');
export const PAYMENT_SUCCEEDED = 'payment.succeeded';

export type PaymentStatus = 'pending' | 'success' | 'failed';

export interface InitializePayment {
  userId: string;
  email: string;
  /** Integer currency subunits (e.g. kobo). Compute prices in trusted business code. */
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  provider?: string;
}

export interface PaymentInitialization {
  reference: string;
  authorizationUrl: string;
  accessCode: string;
}

export interface PaymentVerification {
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: Date | null;
}

export interface PaymentAdapter {
  readonly name: string;
  initialize(
    request: InitializePayment & { reference: string; currency: string },
  ): Promise<PaymentInitialization>;
  verify(reference: string): Promise<PaymentVerification>;
  /** Authenticate exact raw bytes and return a successful charge reference, or null for ignored events. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): string | null;
}

export interface PaymentSucceededEvent {
  id: string;
  userId: string;
  reference: string;
  provider: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown> | null;
}

import { BadGatewayException, Injectable } from '@nestjs/common';

/** Bounded external requests. Never expose provider bodies or credentials. */
@Injectable()
export class ProviderHttpClient {
  async request<T>(
    provider: string,
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error('Provider rejected request');
      return (await response.json()) as T;
    } catch {
      throw new BadGatewayException(`${provider} request failed`);
    }
  }
}

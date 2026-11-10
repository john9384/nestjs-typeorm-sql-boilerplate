import { ProviderHttpClient } from './provider-http.client';

describe('ProviderHttpClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('bounds external requests and rejects redirects', async () => {
    const request = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    await expect(
      new ProviderHttpClient().request(
        'Test',
        'https://example.com',
        { method: 'GET' },
        1000,
      ),
    ).resolves.toEqual({ ok: true });
    const [url, options] = request.mock.calls[0];
    expect(url).toBe('https://example.com');
    expect(options?.redirect).toBe('error');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([401, 429, 500])('sanitizes HTTP %d errors', async (status) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('secret provider response', { status }));
    await expect(
      new ProviderHttpClient().request('Test', 'https://example.com', {}, 1000),
    ).rejects.toThrow('Test request failed');
  });

  it('sanitizes network failures', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('secret URL and credentials'));
    await expect(
      new ProviderHttpClient().request('Test', 'https://example.com', {}, 1000),
    ).rejects.toThrow('Test request failed');
  });
});

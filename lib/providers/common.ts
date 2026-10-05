export type ProviderId = 'gemini' | 'openai';

export type ErrorKind = 'auth' | 'rate_limit' | 'refused' | 'timeout' | 'cancelled' | 'garment' | 'no_photos' | 'provider' | 'storage';

export class TryOnError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'TryOnError';
  }
}

export interface GenerateInput {
  apiKey: string;
  model: string;
  prompt: string;
  /** Ordered: base photo, identity references, garment. */
  images: Blob[];
  aspectRatio: string;
  signal: AbortSignal;
}

export type FetchFn = typeof fetch;

export const REFUSED_MESSAGE = 'The provider declined this image. Try another product photo or base photo.';

export function httpError(provider: string, status: number, message: string): TryOnError {
  if (status === 429) return new TryOnError('rate_limit', `${provider} rate limit or quota reached: ${message}`);
  if (status === 401 || status === 403 || /api key not valid|invalid api key|incorrect api key/i.test(message)) {
    return new TryOnError('auth', `${provider} rejected the API key. Check it in Settings.`);
  }
  if (/safety|moderation|blocked|policy/i.test(message)) return new TryOnError('refused', REFUSED_MESSAGE);
  return new TryOnError('provider', `${provider} error ${status}: ${message}`);
}

export async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } };
    return String(body.error?.message ?? res.statusText).slice(0, 300);
  } catch {
    return res.statusText;
  }
}

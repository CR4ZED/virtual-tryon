import { TryOnError, httpError, readErrorMessage, type FetchFn, type ProviderId } from './common';

export interface ModelOption {
  provider: ProviderId;
  id: string;
  label: string;
}

export const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const OPENAI_MODELS_ENDPOINT = 'https://api.openai.com/v1/models';

// Only models that can edit a photo from reference images. Imagen is excluded on
// purpose: it generates from text alone and cannot dress an existing photo.
const GEMINI_IMAGE = /^gemini-.*image/;
const OPENAI_IMAGE = /^gpt-image-/;
const MAX_PAGES = 5;

async function json<T>(res: Response, provider: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new TryOnError('provider', `${provider} returned an unexpected response.`);
  }
}

export async function listGeminiModels(apiKey: string, signal?: AbortSignal, fetchFn: FetchFn = fetch): Promise<ModelOption[]> {
  const out: ModelOption[] = [];
  let pageToken = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${GEMINI_MODELS_ENDPOINT}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetchFn(url, { headers: { 'x-goog-api-key': apiKey }, signal });
    if (!res.ok) throw httpError('Gemini', res.status, await readErrorMessage(res));
    const body = await json<{ models?: unknown; nextPageToken?: unknown }>(res, 'Gemini');
    const models = Array.isArray(body?.models) ? (body.models as Array<{ name?: unknown; displayName?: unknown }>) : [];
    for (const m of models) {
      const id = typeof m.name === 'string' ? m.name.replace(/^models\//, '') : '';
      if (!GEMINI_IMAGE.test(id)) continue;
      out.push({ provider: 'gemini', id, label: typeof m.displayName === 'string' && m.displayName ? m.displayName : id });
    }
    if (typeof body?.nextPageToken !== 'string' || !body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return out;
}

export async function listOpenAIModels(apiKey: string, signal?: AbortSignal, fetchFn: FetchFn = fetch): Promise<ModelOption[]> {
  const res = await fetchFn(OPENAI_MODELS_ENDPOINT, { headers: { Authorization: `Bearer ${apiKey}` }, signal });
  if (!res.ok) throw httpError('OpenAI', res.status, await readErrorMessage(res));
  const body = await json<{ data?: unknown }>(res, 'OpenAI');
  if (!Array.isArray(body?.data)) throw new TryOnError('provider', 'OpenAI returned an unexpected response.');
  return (body.data as Array<{ id?: unknown }>).flatMap((m) =>
    typeof m.id === 'string' && OPENAI_IMAGE.test(m.id) ? [{ provider: 'openai' as const, id: m.id, label: m.id }] : [],
  );
}

export function listModels(provider: ProviderId, apiKey: string, signal?: AbortSignal): Promise<ModelOption[]> {
  return provider === 'gemini' ? listGeminiModels(apiKey, signal) : listOpenAIModels(apiKey, signal);
}

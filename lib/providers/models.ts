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
// gpt-image-1-mini has no input_fidelity option, so it redraws faces and bodies
// freely; it cannot meet the "do not change the person" requirement.
const OPENAI_LOW_FIDELITY = /^gpt-image-1-mini/;
const MAX_PAGES = 5;

// Defaults chosen after a key is verified, best first. A bare id also matches its
// dated or variant snapshots (e.g. "gpt-image-2.5" matches "gpt-image-2.5-flare").
const PREFERRED_MODELS: Record<ProviderId, string[]> = {
  gemini: ['gemini-3.1-flash-image'],
  openai: ['gpt-image-2.5-sunburst', 'gpt-image-2.5', 'gpt-image-2'],
};

export function pickDefaultModel(provider: ProviderId, models: ModelOption[]): ModelOption | undefined {
  for (const id of PREFERRED_MODELS[provider]) {
    const hit = models.find((m) => m.id === id) ?? models.find((m) => m.id.startsWith(`${id}-`));
    if (hit) return hit;
  }
  return models[0];
}

export function preservesIdentity(provider: ProviderId, id: string): boolean {
  return provider === 'gemini' ? GEMINI_IMAGE.test(id) : OPENAI_IMAGE.test(id) && !OPENAI_LOW_FIDELITY.test(id);
}

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
      if (!preservesIdentity('gemini', id)) continue;
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
    typeof m.id === 'string' && preservesIdentity('openai', m.id) ? [{ provider: 'openai' as const, id: m.id, label: m.id }] : [],
  );
}

export function listModels(provider: ProviderId, apiKey: string, signal?: AbortSignal): Promise<ModelOption[]> {
  return provider === 'gemini' ? listGeminiModels(apiKey, signal) : listOpenAIModels(apiKey, signal);
}

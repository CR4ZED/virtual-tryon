// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { GEMINI_MODELS_ENDPOINT, OPENAI_MODELS_ENDPOINT, listGeminiModels, listOpenAIModels } from '@/lib/providers/models';

describe('listGeminiModels', () => {
  it('keeps only Gemini image models, strips the models/ prefix and follows pages', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          models: [
            { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' },
            { name: 'models/gemini-3.1-flash-image', displayName: 'Nano Banana 2' },
            { name: 'models/imagen-4.0-generate-001', displayName: 'Imagen 4' },
          ],
          nextPageToken: 'p2',
        }),
      )
      .mockResolvedValueOnce(Response.json({ models: [{ name: 'models/gemini-3-pro-image-preview', displayName: '' }] }));

    expect(await listGeminiModels('k', undefined, fetchFn)).toEqual([
      { provider: 'gemini', id: 'gemini-3.1-flash-image', label: 'Nano Banana 2' },
      { provider: 'gemini', id: 'gemini-3-pro-image-preview', label: 'gemini-3-pro-image-preview' },
    ]);
    expect(fetchFn.mock.calls[0]![0]).toBe(`${GEMINI_MODELS_ENDPOINT}?pageSize=1000`);
    expect(fetchFn.mock.calls[1]![0]).toBe(`${GEMINI_MODELS_ENDPOINT}?pageSize=1000&pageToken=p2`);
    expect((fetchFn.mock.calls[0]![1]?.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
  });

  it('maps an invalid key to an auth error', async () => {
    const fetchFn = async () => Response.json({ error: { message: 'API key not valid. Please pass a valid API key.' } }, { status: 400 });
    await expect(listGeminiModels('bad', undefined, fetchFn)).rejects.toMatchObject({ kind: 'auth' });
  });

  it('maps a non-JSON response to a provider error', async () => {
    await expect(listGeminiModels('k', undefined, async () => new Response('<html>'))).rejects.toMatchObject({ kind: 'provider' });
  });

  it('stops after 5 pages even if the server keeps paginating', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => Response.json({ models: [], nextPageToken: 'again' }));
    expect(await listGeminiModels('k', undefined, fetchFn)).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });
});

describe('listOpenAIModels', () => {
  it('keeps only gpt-image models and sends the bearer key', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      Response.json({ object: 'list', data: [{ id: 'gpt-5' }, { id: 'gpt-image-2' }, { id: 'dall-e-3' }, { id: 'gpt-image-1-mini' }] }),
    );
    expect(await listOpenAIModels('k', undefined, fetchFn)).toEqual([
      { provider: 'openai', id: 'gpt-image-2', label: 'gpt-image-2' },
      { provider: 'openai', id: 'gpt-image-1-mini', label: 'gpt-image-1-mini' },
    ]);
    expect(fetchFn.mock.calls[0]![0]).toBe(OPENAI_MODELS_ENDPOINT);
    expect((fetchFn.mock.calls[0]![1]?.headers as Record<string, string>).Authorization).toBe('Bearer k');
  });

  it('maps 401 to an auth error and a malformed body to a provider error', async () => {
    await expect(listOpenAIModels('bad', undefined, async () => Response.json({ error: { message: 'Incorrect API key provided' } }, { status: 401 }))).rejects.toMatchObject({ kind: 'auth' });
    await expect(listOpenAIModels('k', undefined, async () => Response.json({ object: 'list' }))).rejects.toMatchObject({ kind: 'provider' });
  });
});

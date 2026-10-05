// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { GEMINI_ENDPOINT, generateGemini } from '@/lib/providers/gemini';
import { OPENAI_ENDPOINT, buildOpenAIForm, generateOpenAI } from '@/lib/providers/openai';
import type { GenerateInput } from '@/lib/providers/common';

const input: GenerateInput = {
  apiKey: 'k',
  model: 'gemini-3.1-flash-image',
  prompt: 'P',
  images: [new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })],
  aspectRatio: '3:4',
  signal: new AbortController().signal,
};

const geminiImage = (data: string) =>
  Response.json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Here you go' }, { type: 'image', mime_type: 'image/png', data }] }] });

describe('generateGemini', () => {
  it('sends ordered inline images then the prompt, and decodes the image', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => geminiImage(btoa('PNGDATA')));
    const blob = await generateGemini(input, fetchFn);
    expect(await blob.text()).toBe('PNGDATA');
    expect(blob.type).toBe('image/png');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(GEMINI_ENDPOINT);
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    expect(JSON.parse(init?.body as string)).toEqual({
      model: 'gemini-3.1-flash-image',
      input: [{ type: 'image', mime_type: 'image/jpeg', data: 'AQID' }, { type: 'text', text: 'P' }],
      response_format: { type: 'image', aspect_ratio: '3:4' },
    });
  });

  it('maps a non-JSON 200 to a provider error', async () => {
    await expect(generateGemini(input, async () => new Response('not json'))).rejects.toMatchObject({ kind: 'provider' });
  });

  it('treats a response with no image as a refusal', async () => {
    const fetchFn = async () => Response.json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'I cannot help' }] }] });
    await expect(generateGemini(input, fetchFn)).rejects.toMatchObject({ kind: 'refused' });
  });

  it.each([
    [400, 'API key not valid. Please pass a valid API key.', 'auth'],
    [403, 'Permission denied', 'auth'],
    [429, 'Quota exceeded for quota metric per API key', 'rate_limit'],
    [400, 'Request blocked by safety filters', 'refused'],
    [500, 'Internal error', 'provider'],
  ])('maps HTTP %i "%s" to %s', async (status, message, kind) => {
    const fetchFn = async () => Response.json({ error: { message } }, { status });
    await expect(generateGemini(input, fetchFn)).rejects.toMatchObject({ kind });
  });
});

describe('generateOpenAI', () => {
  it('sends ordered multipart images and decodes b64_json', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => Response.json({ data: [{ b64_json: btoa('OUT') }] }));
    const images = [new Blob(['a'], { type: 'image/jpeg' }), new Blob(['b'], { type: 'image/jpeg' })];
    const blob = await generateOpenAI({ ...input, model: 'gpt-image-2', images }, fetchFn);
    expect(await blob.text()).toBe('OUT');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(OPENAI_ENDPOINT);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer k');
    const form = init?.body as FormData;
    expect(await Promise.all((form.getAll('image[]') as File[]).map((f) => f.text()))).toEqual(['a', 'b']);
    expect(form.get('quality')).toBe('high');
    expect(form.get('input_fidelity')).toBeNull();
  });

  it('sends input_fidelity only for the gpt-image-1 family', () => {
    const base = { prompt: 'P', images: [] };
    expect(buildOpenAIForm({ ...base, model: 'gpt-image-1' }).get('input_fidelity')).toBe('high');
    expect(buildOpenAIForm({ ...base, model: 'gpt-image-1.5-2026-01-01' }).get('input_fidelity')).toBe('high');
    expect(buildOpenAIForm({ ...base, model: 'gpt-image-1-mini' }).get('input_fidelity')).toBeNull();
  });

  it('maps undecodable base64 to a provider error', async () => {
    const fetchFn = async () => Response.json({ data: [{ b64_json: '***' }] });
    await expect(generateOpenAI(input, fetchFn)).rejects.toMatchObject({ kind: 'provider' });
  });

  it('maps moderation and auth errors', async () => {
    const moderation = async () => Response.json({ error: { message: 'Your request was rejected by the safety system.', code: 'moderation_blocked' } }, { status: 400 });
    await expect(generateOpenAI(input, moderation)).rejects.toMatchObject({ kind: 'refused' });
    const badKey = async () => Response.json({ error: { message: 'Incorrect API key provided' } }, { status: 401 });
    await expect(generateOpenAI(input, badKey)).rejects.toMatchObject({ kind: 'auth' });
  });
});

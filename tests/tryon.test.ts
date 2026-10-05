// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { addPhoto, deleteAllData, getSettings, latestResultFor, saveSettings } from '@/lib/db';
import { runTryOn, type TryOnRequest } from '@/lib/tryon';

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getSettings: vi.fn(actual.getSettings) };
});
vi.mock('@/lib/imageProcessing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/imageProcessing')>()),
  normalizeImage: vi.fn(async (blob: Blob) => ({ blob, width: 10, height: 10 })),
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const req: TryOnRequest = {
  productUrl: 'https://shop.example.com/p/1',
  garmentUrl: 'https://cdn.example.com/g.png',
  title: 'Linen Shirt',
  basePhotoId: null,
  matchPose: false,
};

function garmentOr(providerResponse: (init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).startsWith('https://cdn.example.com/')) {
      const res = new Response(PNG);
      Object.defineProperty(res, 'url', { value: String(url) });
      return res;
    }
    return providerResponse(init);
  });
}

beforeEach(async () => {
  fakeBrowser.reset();
  await deleteAllData();
});
afterEach(() => vi.unstubAllGlobals());

describe('runTryOn', () => {
  it('requires an API key for the selected provider', async () => {
    await expect(runTryOn(req, new AbortController().signal)).rejects.toMatchObject({ kind: 'auth' });
  });

  it('refuses models that cannot keep the face and body unchanged', async () => {
    await saveSettings({ provider: 'openai', openaiKey: 'k', openaiModel: 'gpt-image-1-mini' });
    await expect(runTryOn(req, new AbortController().signal)).rejects.toMatchObject({ kind: 'auth', message: expect.stringContaining('gpt-image-1-mini') });
  });

  it('requires a photo', async () => {
    await saveSettings({ geminiKey: 'k' });
    await expect(runTryOn(req, new AbortController().signal)).rejects.toMatchObject({ kind: 'no_photos' });
  });

  it('generates with Gemini and stores the result', async () => {
    await saveSettings({ geminiKey: 'k' });
    await addPhoto(new Blob(['me'], { type: 'image/jpeg' }), 768, 1024);
    vi.stubGlobal(
      'fetch',
      garmentOr(() => Response.json({ steps: [{ type: 'model_output', content: [{ type: 'image', mime_type: 'image/png', data: btoa('OUT') }] }] })),
    );
    const rec = await runTryOn(req, new AbortController().signal);
    expect(rec.provider).toBe('gemini');
    expect(await rec.blob.text()).toBe('OUT');
    expect((await latestResultFor(req.productUrl))?.id).toBe(rec.id);
  });

  it('reports a user abort as cancelled', async () => {
    await saveSettings({ geminiKey: 'k' });
    await addPhoto(new Blob(['me'], { type: 'image/jpeg' }), 768, 1024);
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))),
    );
    const ctrl = new AbortController();
    const pending = runTryOn(req, ctrl.signal);
    ctrl.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  });

  it('reports a user abort during the provider call as cancelled', async () => {
    await saveSettings({ geminiKey: 'k' });
    await addPhoto(new Blob(['me'], { type: 'image/jpeg' }), 768, 1024);
    let providerCalled!: () => void;
    const called = new Promise<void>((r) => (providerCalled = r));
    vi.stubGlobal(
      'fetch',
      garmentOr((init) => {
        providerCalled();
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
      }),
    );
    const ctrl = new AbortController();
    const pending = runTryOn(req, ctrl.signal);
    await called;
    ctrl.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  });

  it('wraps unexpected storage failures in a TryOnError', async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('boom'));
    await expect(runTryOn(req, new AbortController().signal)).rejects.toMatchObject({ name: 'TryOnError', kind: 'provider', message: 'boom' });
  });
});

// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { addPhoto, deleteAllData, latestResultFor, saveSettings } from '@/lib/db';
import { runTryOn, type TryOnRequest } from '@/lib/tryon';

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

function garmentOr(providerResponse: () => Response) {
  return vi.fn(async (url: string | URL | Request) => {
    if (String(url).startsWith('https://cdn.example.com/')) {
      const res = new Response(PNG);
      Object.defineProperty(res, 'url', { value: String(url) });
      return res;
    }
    return providerResponse();
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
});

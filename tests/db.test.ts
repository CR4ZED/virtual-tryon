// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  DEFAULT_SETTINGS,
  addPhoto,
  deleteAllData,
  deletePhoto,
  getResult,
  getSettings,
  latestResultFor,
  listPhotos,
  saveResult,
  saveSettings,
  setPrimaryPhoto,
} from '@/lib/db';

const blob = new Blob(['img'], { type: 'image/jpeg' });
const result = (productUrl = 'https://shop.example.com/p/1') => ({ blob, productUrl, basePhotoId: 'p', matchPose: false, provider: 'gemini' as const });

beforeEach(async () => {
  fakeBrowser.reset();
  await deleteAllData();
});

describe('settings', () => {
  it('returns defaults and merges patches', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ geminiKey: 'abc' });
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, geminiKey: 'abc' });
  });
});

describe('photos', () => {
  it('makes the first photo primary, caps at 4, promotes on primary delete', async () => {
    const a = await addPhoto(blob, 100, 200);
    const b = await addPhoto(blob, 100, 200);
    expect([a.primary, b.primary]).toEqual([true, false]);
    await addPhoto(blob, 1, 1);
    await addPhoto(blob, 1, 1);
    await expect(addPhoto(blob, 1, 1)).rejects.toThrow('up to 4');
    await deletePhoto(a.id);
    const photos = await listPhotos();
    expect(photos).toHaveLength(3);
    expect(photos.filter((p) => p.primary).map((p) => p.id)).toEqual([b.id]);
  });

  it('setPrimaryPhoto leaves exactly one primary', async () => {
    await addPhoto(blob, 1, 1);
    const b = await addPhoto(blob, 1, 1);
    await setPrimaryPhoto(b.id);
    expect((await listPhotos()).filter((p) => p.primary).map((p) => p.id)).toEqual([b.id]);
  });
});

describe('results', () => {
  it('returns the latest result for a product', async () => {
    await saveResult(result(), new Set());
    const newer = await saveResult(result(), new Set());
    expect((await latestResultFor('https://shop.example.com/p/1'))?.id).toBe(newer.id);
    expect(await latestResultFor('https://shop.example.com/other')).toBeUndefined();
  });

  it('evicts the oldest results beyond 50 but never cart-referenced ones', async () => {
    const pinned = await saveResult(result(), new Set());
    const second = await saveResult(result(), new Set([pinned.id]));
    let last = second;
    for (let i = 0; i < 49; i++) last = await saveResult(result(), new Set([pinned.id]));
    expect(await getResult(pinned.id)).toBeDefined();
    expect(await getResult(second.id)).toBeUndefined();
    expect(await getResult(last.id)).toBeDefined();
  });
});

describe('deleteAllData', () => {
  it('wipes IndexedDB and extension storage', async () => {
    await saveSettings({ openaiKey: 'x' });
    await addPhoto(blob, 1, 1);
    await fakeBrowser.storage.local.set({ cart: [{ id: '1' }] });
    await deleteAllData();
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await listPhotos()).toEqual([]);
    expect(await fakeBrowser.storage.local.get('cart')).toEqual({});
  });
});

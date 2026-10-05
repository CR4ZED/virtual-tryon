// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fetchGarment } from '@/lib/garment';
import { MAX_GARMENT_BYTES } from '@/lib/validate';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const URL_OK = 'https://cdn.example.com/a.png';
const signal = new AbortController().signal;

function response(body: BodyInit, init?: ResponseInit, finalUrl = URL_OK): Response {
  const res = new Response(body, init);
  Object.defineProperty(res, 'url', { value: finalUrl });
  return res;
}

describe('fetchGarment', () => {
  it('returns the image', async () => {
    const blob = await fetchGarment(URL_OK, signal, async () => response(PNG));
    expect(blob.size).toBe(PNG.length);
  });

  it('refuses unsafe URLs without fetching', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    await expect(fetchGarment('https://127.0.0.1/a.png', signal, fetchFn)).rejects.toMatchObject({ kind: 'garment' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuses redirects to private hosts', async () => {
    await expect(fetchGarment(URL_OK, signal, async () => response(PNG, {}, 'https://192.168.0.10/a.png'))).rejects.toMatchObject({ kind: 'garment' });
  });

  it('enforces the size cap while streaming even if content-length lies', async () => {
    const big = new Uint8Array(MAX_GARMENT_BYTES + 1);
    big.set(PNG);
    await expect(fetchGarment(URL_OK, signal, async () => response(big, { headers: { 'content-length': '10' } }))).rejects.toMatchObject({ kind: 'garment' });
  });

  it('refuses non-images and HTTP errors', async () => {
    await expect(fetchGarment(URL_OK, signal, async () => response('<html>'))).rejects.toMatchObject({ kind: 'garment' });
    await expect(fetchGarment(URL_OK, signal, async () => response(PNG, { status: 404 }))).rejects.toMatchObject({ kind: 'garment' });
  });
});

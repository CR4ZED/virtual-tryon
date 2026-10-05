// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { base64ToBlob, blobToBase64, fitWithin, nearestAspectRatio } from '@/lib/imageProcessing';

describe('fitWithin', () => {
  it('downscales the long edge to 1536 and never upscales', () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1152, height: 1536 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('guards against zero dimensions in extreme aspect ratios', () => {
    expect(fitWithin(1, 5000)).toEqual({ width: 1, height: 1536 });
  });
});

describe('nearestAspectRatio', () => {
  it.each([
    [1152, 1536, '3:4'],
    [1920, 1080, '16:9'],
    [1000, 1000, '1:1'],
    [1000, 2200, '9:16'],
  ])('%i x %i -> %s', (w, h, ratio) => expect(nearestAspectRatio(w, h)).toBe(ratio));
});

describe('base64 helpers', () => {
  it('round-trips binary data', async () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256);
    const b64 = await blobToBase64(new Blob([bytes]));
    const back = new Uint8Array(await base64ToBlob(b64, 'image/png').arrayBuffer());
    expect(back).toEqual(bytes);
    expect(await blobToBase64(new Blob([new Uint8Array([1, 2, 3])]))).toBe('AQID');
  });
});

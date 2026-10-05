export const MAX_EDGE = 1536;

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

export function fitWithin(w: number, h: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function nearestAspectRatio(w: number, h: number): string {
  const target = Math.log(w / h);
  const distance = (r: string) => {
    const parts = r.split(':').map(Number);
    const a = parts[0]!;
    const b = parts[1]!;
    return Math.abs(Math.log(a / b) - target);
  };
  return ASPECT_RATIOS.reduce((best, r) => (distance(r) < distance(best) ? r : best));
}

/**
 * Decodes (rejecting malformed files), applies EXIF orientation, downscales, and
 * re-encodes as JPEG. Re-encoding strips all metadata including GPS.
 */
export async function normalizeImage(blob: Blob, maxEdge = MAX_EDGE): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.fillStyle = '#fff'; // transparent PNG pixels would otherwise become black in JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return { blob: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 }), width, height };
  } finally {
    bitmap.close();
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

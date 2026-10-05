export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_GARMENT_BYTES = 15 * 1024 * 1024;
export const MAX_PHOTOS = 4;
export const MIN_PHOTO_SHORT_EDGE = 512;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif';

const UPLOAD_TYPES: readonly ImageMime[] = ['image/jpeg', 'image/png', 'image/webp'];

export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif';
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
  return null;
}

export async function validateUpload(
  file: Blob,
): Promise<{ ok: true; type: ImageMime } | { ok: false; error: string }> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Photo is larger than 10 MB.' };
  const type = sniffImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!type || !UPLOAD_TYPES.includes(type)) return { ok: false, error: 'Use a JPEG, PNG or WebP photo.' };
  return { ok: true, type };
}

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/**
 * True only for https URLs on public hostnames. The WHATWG URL parser normalizes
 * tricks like `0x7f.1` to `127.0.0.1` before we check.
 * ponytail: no DNS-rebinding protection (a public name resolving to a private IP);
 * acceptable because requests carry no credentials and responses must be images.
 */
export function isSafeHttpsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa)$/.test(host)) return false;
  if (host.startsWith('[')) return !/^\[(::1?\]|f[cd]|fe[89ab]|::ffff:)/.test(host);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !PRIVATE_IPV4.some((re) => re.test(host));
  return host.includes('.');
}

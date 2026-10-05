import { TryOnError, type FetchFn } from './providers/common';
import { MAX_GARMENT_BYTES, isSafeHttpsUrl, sniffImageType } from './validate';

const PICK_HINT = 'Use "Pick image" to choose another photo.';

async function readCapped(res: Response, max: number, signal: AbortSignal): Promise<Blob | null> {
  if (!res.body) return new Blob([]);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (signal.aborted) throw e;
      throw new TryOnError('garment', `Could not download the product image. ${PICK_HINT}`);
    }
    const { done, value } = chunk;
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') ?? '' });
}

/** Downloads the product image from the extension origin (no page cookies, no CORS). */
export async function fetchGarment(url: string, signal: AbortSignal, fetchFn: FetchFn = fetch): Promise<Blob> {
  if (!isSafeHttpsUrl(url)) throw new TryOnError('garment', `This product image address is not allowed. ${PICK_HINT}`);
  let res: Response;
  try {
    res = await fetchFn(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new TryOnError('garment', `Could not download the product image. ${PICK_HINT}`);
  }
  if (!res.ok) throw new TryOnError('garment', `The store refused the product image (HTTP ${res.status}). ${PICK_HINT}`);
  // ponytail: fetch follows redirects before we can check them, so a redirect to a private host still sends one blind GET (no data returned to us). Any web page can already cause the same request via <img>; redirect:'manual' would break legitimate CDN redirects.
  if (!isSafeHttpsUrl(res.url)) throw new TryOnError('garment', `The product image redirected to a blocked address. ${PICK_HINT}`);
  const tooLarge = new TryOnError('garment', `The product image is larger than 15 MB. ${PICK_HINT}`);
  if (Number(res.headers.get('content-length')) > MAX_GARMENT_BYTES) throw tooLarge;
  const blob = await readCapped(res, MAX_GARMENT_BYTES, signal);
  if (!blob) throw tooLarge;
  if (!sniffImageType(new Uint8Array(await blob.slice(0, 16).arrayBuffer()))) {
    throw new TryOnError('garment', `The selected file is not a supported image. ${PICK_HINT}`);
  }
  return blob;
}

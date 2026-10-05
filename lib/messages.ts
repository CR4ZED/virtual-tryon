import type { ProductInfo } from './detect';
import { isSafeHttpsUrl } from './validate';

export type Message =
  | { type: 'openPanel' }
  | { type: 'getProduct' }
  | { type: 'startPicker' }
  | { type: 'productChanged'; product: ProductInfo | null }
  | { type: 'picked'; url: string };

function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.length <= max ? v : undefined;
}

function nullableStr(v: unknown, max: number): string | null | undefined {
  return v === null ? null : str(v, max);
}

/** Validates a ProductInfo coming from a content script (untrusted page context). */
export function parseProduct(raw: unknown): ProductInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const url = str(r.url, 2048);
  const title = str(r.title, 500);
  const storeName = str(r.storeName, 100);
  const price = nullableStr(r.price, 40);
  const garmentImage = nullableStr(r.garmentImage, 2048);
  if (!url || !isSafeHttpsUrl(url) || title === undefined || !storeName) return null;
  if (price === undefined || garmentImage === undefined) return null;
  if (garmentImage !== null && !isSafeHttpsUrl(garmentImage)) return null;
  if (!Array.isArray(r.gallery) || r.gallery.length > 8) return null;
  const gallery = r.gallery.filter((u): u is string => typeof u === 'string' && u.length <= 2048 && isSafeHttpsUrl(u));
  return { url, title, price, storeName, garmentImage, gallery };
}

export function parseMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case 'openPanel':
    case 'getProduct':
    case 'startPicker':
      return { type: r.type };
    case 'productChanged': {
      if (r.product === null) return { type: 'productChanged', product: null };
      const product = parseProduct(r.product);
      return product ? { type: 'productChanged', product } : null;
    }
    case 'picked': {
      const url = str(r.url, 2048);
      return url && isSafeHttpsUrl(url) ? { type: 'picked', url } : null;
    }
    default:
      return null;
  }
}

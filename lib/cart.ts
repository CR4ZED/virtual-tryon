import { browser, type Browser } from 'wxt/browser';
import { isSafeHttpsUrl } from './validate';

export interface CartItem {
  id: string;
  store: string;
  storeName: string;
  title: string;
  price: string | null;
  productImageUrl: string | null;
  productUrl: string;
  resultId: string | null;
  note: string;
  bought: boolean;
  addedAt: number;
}

export type NewCartItem = Pick<CartItem, 'storeName' | 'title' | 'price' | 'productImageUrl' | 'productUrl' | 'resultId'>;

export const MAX_NOTE = 100;
const KEY = 'cart';

export async function getCart(): Promise<CartItem[]> {
  const stored = (await browser.storage.local.get(KEY))[KEY];
  return Array.isArray(stored) ? (stored as CartItem[]) : [];
}

// ponytail: read-modify-write without locking; two panels editing in the same instant can drop one write.
async function save(items: CartItem[]): Promise<void> {
  await browser.storage.local.set({ [KEY]: items });
}

export async function addToCart(input: NewCartItem): Promise<CartItem> {
  if (!isSafeHttpsUrl(input.productUrl)) throw new Error('Only https product pages can be added to the cart.');
  const productUrl = input.productUrl.split('#', 1)[0] ?? '';
  const fields: NewCartItem = {
    storeName: input.storeName,
    title: input.title,
    price: input.price,
    productImageUrl: input.productImageUrl && isSafeHttpsUrl(input.productImageUrl) ? input.productImageUrl : null,
    productUrl,
    resultId: input.resultId,
  };
  const items = await getCart();
  const existing = items.find((i) => i.productUrl === productUrl);
  if (existing) {
    const updated: CartItem = { ...existing, ...fields, productImageUrl: fields.productImageUrl ?? existing.productImageUrl, resultId: input.resultId ?? existing.resultId };
    await save(items.map((i) => (i.id === existing.id ? updated : i)));
    return updated;
  }
  const item: CartItem = { ...fields, id: crypto.randomUUID(), store: new URL(productUrl).hostname, note: '', bought: false, addedAt: Date.now() };
  await save([...items, item]);
  return item;
}

export async function removeFromCart(id: string): Promise<void> {
  await save((await getCart()).filter((i) => i.id !== id));
}

export async function updateCartItem(id: string, patch: { note?: string; bought?: boolean }): Promise<void> {
  const clean = {
    ...(patch.note !== undefined && { note: patch.note.slice(0, MAX_NOTE) }),
    ...(patch.bought !== undefined && { bought: patch.bought }),
  };
  await save((await getCart()).map((i) => (i.id === id ? { ...i, ...clean } : i)));
}

export function groupByStore(items: CartItem[]): { store: string; storeName: string; items: CartItem[] }[] {
  const groups = new Map<string, { store: string; storeName: string; items: CartItem[] }>();
  for (const item of items) {
    const group = groups.get(item.store) ?? { store: item.store, storeName: item.storeName, items: [] };
    group.items.push(item);
    groups.set(item.store, group);
  }
  return [...groups.values()];
}

export function referencedResultIds(items: CartItem[]): Set<string> {
  return new Set(items.flatMap((i) => (i.resultId ? [i.resultId] : [])));
}

export function onCartChanged(cb: (items: CartItem[]) => void): () => void {
  const listener = (changes: Record<string, Browser.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) cb((changes[KEY].newValue as CartItem[] | undefined) ?? []);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

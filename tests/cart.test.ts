// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { addToCart, getCart, groupByStore, referencedResultIds, removeFromCart, updateCartItem, type NewCartItem } from '@/lib/cart';

const dress: NewCartItem = {
  storeName: 'Myntra',
  title: 'Black Dress',
  price: 'INR 1299',
  productImageUrl: 'https://assets.myntassets.com/a.jpg',
  productUrl: 'https://www.myntra.com/dresses/1#reviews',
  resultId: null,
};
const shirt: NewCartItem = { ...dress, storeName: 'Amazon.in', title: 'Shirt', productUrl: 'https://www.amazon.in/dp/B01' };

beforeEach(() => fakeBrowser.reset());

describe('cart', () => {
  it('dedupes by product URL ignoring the hash and keeps an existing result', async () => {
    await addToCart(dress);
    await addToCart({ ...dress, productUrl: 'https://www.myntra.com/dresses/1', resultId: 'r1' });
    await addToCart({ ...dress, resultId: null });
    const cart = await getCart();
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ store: 'www.myntra.com', productUrl: 'https://www.myntra.com/dresses/1', resultId: 'r1', bought: false, note: '' });
  });

  it('rejects non-https product URLs', async () => {
    await expect(addToCart({ ...dress, productUrl: 'http://shop.example.com/p' })).rejects.toThrow();
  });

  it('updates notes (capped at 100) and bought state, and removes items', async () => {
    const item = await addToCart(dress);
    await updateCartItem(item.id, { note: 'Size M '.repeat(30), bought: true });
    const [updated] = await getCart();
    expect(updated?.note).toHaveLength(100);
    expect(updated?.bought).toBe(true);
    await removeFromCart(item.id);
    expect(await getCart()).toEqual([]);
  });

  it('groups by store in insertion order and lists referenced results', async () => {
    await addToCart(dress);
    await addToCart({ ...shirt, resultId: 'r2' });
    await addToCart({ ...dress, title: 'Kurta', productUrl: 'https://www.myntra.com/kurta/2', resultId: 'r3' });
    const cart = await getCart();
    expect(groupByStore(cart).map((g) => [g.storeName, g.items.length])).toEqual([['Myntra', 2], ['Amazon.in', 1]]);
    expect(referencedResultIds(cart)).toEqual(new Set(['r2', 'r3']));
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseMessage, parseProduct } from '@/lib/messages';

const product = {
  url: 'https://www.myntra.com/dresses/roadster/123',
  title: 'Roadster Women Black Solid A-Line Dress',
  price: 'INR 1299',
  storeName: 'Myntra',
  garmentImage: 'https://assets.myntassets.com/a.jpg',
  gallery: ['https://assets.myntassets.com/b.jpg'],
};

describe('parseMessage', () => {
  it('accepts every known message', () => {
    expect(parseMessage({ type: 'openPanel' })).toEqual({ type: 'openPanel' });
    expect(parseMessage({ type: 'getProduct' })).toEqual({ type: 'getProduct' });
    expect(parseMessage({ type: 'startPicker' })).toEqual({ type: 'startPicker' });
    expect(parseMessage({ type: 'productChanged', product })).toEqual({ type: 'productChanged', product });
    expect(parseMessage({ type: 'productChanged', product: null })).toEqual({ type: 'productChanged', product: null });
    expect(parseMessage({ type: 'picked', url: 'https://cdn.example.com/x.jpg' })).toEqual({ type: 'picked', url: 'https://cdn.example.com/x.jpg' });
  });

  it('drops unexpected fields', () => {
    expect(parseMessage({ type: 'openPanel', apiKey: 'steal' })).toEqual({ type: 'openPanel' });
  });

  it.each([
    null,
    'openPanel',
    { type: 'generate' },
    { type: 'picked', url: 'javascript:alert(1)' },
    { type: 'picked', url: 'https://127.0.0.1/a.jpg' },
    { type: 'productChanged', product: { ...product, garmentImage: 'http://x.com/a.jpg' } },
    { type: 'productChanged', product: { ...product, title: 'x'.repeat(501) } },
    { type: 'productChanged', product: { ...product, gallery: 'nope' } },
    { type: 'productChanged', product: { ...product, url: 'chrome://settings' } },
  ])('rejects %j', (raw) => expect(parseMessage(raw)).toBeNull());
});

describe('parseProduct', () => {
  it('filters unsafe gallery URLs instead of rejecting the product', () => {
    expect(parseProduct({ ...product, gallery: ['https://ok.com/a.jpg', 'http://bad.com/b.jpg'] })?.gallery).toEqual(['https://ok.com/a.jpg']);
  });
});

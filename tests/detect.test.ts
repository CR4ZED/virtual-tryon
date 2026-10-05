import { describe, expect, it } from 'vitest';
import { detectProduct, isClothing } from '@/lib/detect';
import { AMAZON, BLOG, FLIPKART, HEADPHONES, MYNTRA, OBFUSCATED_PRICE, PHONE_CASE, SHOPIFY } from './fixtures';

function detect(html: string, url: string) {
  document.head.innerHTML = '';
  document.body.innerHTML = html;
  return detectProduct(document, url);
}

describe('detectProduct', () => {
  it('Amazon: no JSON-LD, uses CTA + price, high-res data attribute', () => {
    expect(detect(AMAZON, 'https://www.amazon.in/dp/B0TEST')).toMatchObject({
      title: "Allen Solly Men's Regular Fit Cotton Casual Shirt",
      price: '₹1,299.00',
      storeName: 'amazon.in',
      garmentImage: 'https://m.media-amazon.com/images/I/71abc._SL1500_.jpg',
    });
  });

  it('Flipkart: JSON-LD array, image and offer price', () => {
    const p = detect(FLIPKART, 'https://www.flipkart.com/roadster-jacket/p/itm123');
    expect(p).toMatchObject({
      title: 'Roadster Men Solid Casual Jacket',
      price: 'INR 1499',
      storeName: 'flipkart.com',
      garmentImage: 'https://rukminim2.flixcart.com/image/832/832/jacket.jpeg',
    });
    expect(p?.gallery).toContain('https://rukminim2.flixcart.com/image/416/416/jacket.jpeg');
  });

  it('Myntra: picks the largest srcset URL even with commas in it', () => {
    expect(detect(MYNTRA, 'https://www.myntra.com/dresses/roadster/123/buy')).toMatchObject({
      title: 'Roadster Women Black Solid A-Line Dress',
      storeName: 'Myntra',
      price: 'INR 1299',
      garmentImage: 'https://assets.myntassets.com/h_1440,q_90,w_1080/v1/assets/images/1/a.jpg',
    });
  });

  it('Shopify: og tags, protocol-relative image', () => {
    expect(detect(SHOPIFY, 'https://www.bombayshirts.com/products/oxford')).toMatchObject({
      title: 'Oxford Button-Down Shirt',
      price: 'Rs. 2,490.00',
      storeName: 'Bombay Shirt Company',
      garmentImage: 'https://cdn.shopify.com/s/files/1/oxford.jpg?v=1',
    });
  });

  it('finds prices in obfuscated markup via text scan', () => {
    expect(detect(OBFUSCATED_PRICE, 'https://shop.example.com/p/jeans')?.price).toBe('₹999');
  });

  it.each([
    ['headphones', HEADPHONES],
    ['phone case with apparel word', PHONE_CASE],
    ['blog post', BLOG],
  ])('returns null for %s', (_name, html) => {
    expect(detect(html, 'https://shop.example.com/p/1')).toBeNull();
  });
});

describe('isClothing', () => {
  it.each(['Cat Print T-Shirt', 'Baby Doll Dress', "Men's Boot-Cut Jeans", 'Roadster Men Solid Casual Jacket', 'Anarkali Kurta Set'])(
    'accepts %s',
    (title) => expect(isClothing(title, '')).toBe(true),
  );

  it.each(["Men's Leather Dress Shoes", 'Clothing Hanger Set of 12', 'Spigen T-Shirt Pattern Phone Case'])(
    'rejects %s',
    (title) => expect(isClothing(title, 'Clothing')).toBe(false),
  );

  it('uses breadcrumbs when the title has no garment noun', () => {
    expect(isClothing('Floral Print Straight Fit', 'Women › Kurtas & Suits')).toBe(true);
    expect(isClothing('Running Pro 2', 'Men › Clothing')).toBe(true);
    expect(isClothing('Running Pro 2 Sneakers', 'Men › Clothing')).toBe(false);
  });
});

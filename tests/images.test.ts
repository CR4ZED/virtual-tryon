import { describe, expect, it } from 'vitest';
import { bestImageUrl, cssBackgroundUrl, imageArea, imageElementAt, parseSrcset } from '@/lib/images';

const base = 'https://shop.example.com/p/1';

function el(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

describe('parseSrcset', () => {
  it('keeps commas that are part of URLs (Cloudinary/Myntra style)', () => {
    expect(
      parseSrcset('https://a.com/h_720,q_90,w_540/x.jpg 540w, https://a.com/h_1440,q_90,w_1080/x.jpg 1080w'),
    ).toEqual([
      { url: 'https://a.com/h_720,q_90,w_540/x.jpg', score: 540 },
      { url: 'https://a.com/h_1440,q_90,w_1080/x.jpg', score: 1080 },
    ]);
  });

  it('handles density descriptors and missing descriptors', () => {
    expect(parseSrcset('a.jpg, b.jpg 2x')).toEqual([
      { url: 'a.jpg', score: 1 },
      { url: 'b.jpg', score: 2 },
    ]);
  });
});

describe('bestImageUrl', () => {
  it('prefers zoom/high-res data attributes', () => {
    expect(bestImageUrl(el('<img src="/s.jpg" data-old-hires="https://cdn.example.com/big.jpg">'), base)).toBe(
      'https://cdn.example.com/big.jpg',
    );
  });

  it('picks the largest srcset candidate including <picture> sources', () => {
    const pic = el('<picture><source srcset="/m.jpg 800w, /l.jpg 1600w"><img src="/s.jpg" srcset="/s.jpg 400w"></picture>');
    expect(bestImageUrl(pic, base)).toBe('https://shop.example.com/l.jpg');
  });

  it('skips data: placeholders and falls back to data-src', () => {
    expect(bestImageUrl(el('<img src="data:image/gif;base64,R0lGOD" data-src="//cdn.example.com/real.jpg">'), base)).toBe(
      'https://cdn.example.com/real.jpg',
    );
  });
});

describe('cssBackgroundUrl', () => {
  it('extracts the first url() and resolves it', () => {
    expect(cssBackgroundUrl('url("https://a.com/x.jpg")', base)).toBe('https://a.com/x.jpg');
    expect(cssBackgroundUrl('linear-gradient(red, blue), url(/y.png)', base)).toBe('https://shop.example.com/y.png');
    expect(cssBackgroundUrl('none', base)).toBeNull();
  });
});

describe('imageArea', () => {
  it('falls back to width/height attributes when not laid out', () => {
    expect(imageArea(el('<img width="300" height="400">'))).toBe(120000);
  });
});

describe('imageElementAt', () => {
  it('skips the picker host and transparent overlays', () => {
    document.body.innerHTML = '<div id="host"></div><div id="overlay"></div><img id="photo" src="/a.jpg">';
    const host = document.getElementById('host')!;
    const overlay = document.getElementById('overlay')!;
    const photo = document.getElementById('photo')!;
    document.elementsFromPoint = () => [host, overlay, photo, document.body, document.documentElement];
    expect(imageElementAt(document, 10, 10, host)).toBe(photo);
  });
});

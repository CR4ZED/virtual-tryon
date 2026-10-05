// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, isSafeHttpsUrl, sniffImageType, validateUpload } from '@/lib/validate';

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe('sniffImageType', () => {
  it('detects supported formats by magic bytes', () => {
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    expect(sniffImageType(ascii('\x89PNG\r\n\x1a\n'))).toBe('image/png');
    expect(sniffImageType(ascii('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageType(ascii('GIF89a'))).toBe('image/gif');
    expect(sniffImageType(ascii('\0\0\0\x1cftypavif'))).toBe('image/avif');
  });

  it('rejects everything else', () => {
    expect(sniffImageType(ascii('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe('validateUpload', () => {
  it('accepts a JPEG', async () => {
    expect(await validateUpload(new Blob([JPEG]))).toEqual({ ok: true, type: 'image/jpeg' });
  });

  it('rejects files over 10 MB', async () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(JPEG);
    expect(await validateUpload(new Blob([big]))).toEqual({ ok: false, error: 'Photo is larger than 10 MB.' });
  });

  it('rejects GIFs and renamed non-images', async () => {
    expect((await validateUpload(new Blob([ascii('GIF89a......')]))).ok).toBe(false);
    expect((await validateUpload(new Blob([ascii('%PDF-1.7')]))).ok).toBe(false);
  });
});

describe('isSafeHttpsUrl', () => {
  it.each([
    'https://m.media-amazon.com/images/I/71abc.jpg',
    'https://assets.myntassets.com/h_1440,q_90,w_1080/v1/a.jpg',
    'https://[2001:db8::1]/a.jpg',
  ])('allows %s', (url) => expect(isSafeHttpsUrl(url)).toBe(true));

  it.each([
    'http://example.com/a.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'https://localhost/a.jpg',
    'https://localhost./a.jpg',
    'https://127.0.0.1/a.jpg',
    'https://0x7f.1/a.jpg',
    'https://10.0.0.5/a.jpg',
    'https://192.168.1.1/a.jpg',
    'https://172.20.0.1/a.jpg',
    'https://169.254.169.254/latest/meta-data',
    'https://100.64.0.1/a.jpg',
    'https://224.0.0.1/a.jpg',
    'https://198.18.0.1/a.jpg',
    'https://[::1]/a.jpg',
    'https://[fd00::1]/a.jpg',
    'https://[fe80::1]/a.jpg',
    'https://printer.local/a.jpg',
    'https://printer.local./a.jpg',
    'https://intranet/a.jpg',
    'https://user:pass@example.com/a.jpg',
    'not a url',
  ])('blocks %s', (url) => expect(isSafeHttpsUrl(url)).toBe(false));
});

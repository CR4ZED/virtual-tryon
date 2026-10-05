const ZOOM_ATTRS = ['data-zoom-image', 'data-zoom', 'data-large-image', 'data-old-hires', 'data-hires', 'data-src-large'];

export function toHttpsUrl(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim(), base);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Spec-style srcset parser: URLs may contain commas, so split on whitespace first. */
export function parseSrcset(srcset: string): { url: string; score: number }[] {
  const out: { url: string; score: number }[] = [];
  let i = 0;
  while (i < srcset.length) {
    while (i < srcset.length && /[\s,]/.test(srcset[i]!)) i++;
    if (i >= srcset.length) break;
    let j = i;
    while (j < srcset.length && !/\s/.test(srcset[j]!)) j++;
    let url = srcset.slice(i, j);
    i = j;
    let descriptor = '';
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      while (i < srcset.length && srcset[i] !== ',') descriptor += srcset[i++];
    }
    const m = /^([\d.]+)[wx]$/.exec(descriptor.trim());
    out.push({ url, score: m ? Number(m[1]) : 1 });
  }
  return out;
}

export function cssBackgroundUrl(value: string, base: string): string | null {
  const m = /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(value);
  return m ? toHttpsUrl(m[2], base) : null;
}

export function bestImageUrl(el: Element, base: string): string | null {
  if (el.tagName === 'PICTURE') {
    const img = el.querySelector('img');
    return img ? bestImageUrl(img, base) : null;
  }
  if (el.tagName !== 'IMG') return cssBackgroundUrl(getComputedStyle(el).backgroundImage, base);

  for (const attr of ZOOM_ATTRS) {
    const url = toHttpsUrl(el.getAttribute(attr), base);
    if (url) return url;
  }
  const sources = el.parentElement?.tagName === 'PICTURE' ? Array.from(el.parentElement.querySelectorAll('source')) : [];
  const srcsets = [el.getAttribute('srcset'), el.getAttribute('data-srcset'), ...sources.map((s) => s.getAttribute('srcset'))];
  const fromSrcset = srcsets
    .flatMap((s) => (s ? parseSrcset(s) : []))
    .sort((a, b) => b.score - a.score)
    .map((c) => toHttpsUrl(c.url, base))
    .find((u): u is string => u !== null);
  if (fromSrcset) return fromSrcset;
  return (
    toHttpsUrl((el as HTMLImageElement).currentSrc, base) ??
    toHttpsUrl(el.getAttribute('src'), base) ??
    toHttpsUrl(el.getAttribute('data-src'), base)
  );
}

export function imageArea(el: Element): number {
  const rect = el.getBoundingClientRect();
  if (rect.width * rect.height > 0) return rect.width * rect.height;
  const img = el as HTMLImageElement;
  if (img.naturalWidth * img.naturalHeight > 0) return img.naturalWidth * img.naturalHeight;
  return (Number(el.getAttribute('width')) || 0) * (Number(el.getAttribute('height')) || 0);
}

/** Topmost image-bearing element at a point, looking through transparent overlays. */
export function imageElementAt(doc: Document, x: number, y: number, skip: Element | null): Element | null {
  for (const el of doc.elementsFromPoint(x, y)) {
    if (el === skip || el === doc.body || el === doc.documentElement) continue;
    if (el.tagName === 'IMG' || el.tagName === 'PICTURE') return el;
    if (cssBackgroundUrl(getComputedStyle(el).backgroundImage, doc.baseURI)) return el;
  }
  return null;
}

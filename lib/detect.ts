import { bestImageUrl, imageArea, toHttpsUrl } from './images';

export interface ProductInfo {
  url: string;
  title: string;
  price: string | null;
  storeName: string;
  garmentImage: string | null;
  gallery: string[];
}

const APPAREL =
  /\b(t-?shirts?|tees?|shirts?|tops?|blouses?|kurtas?|kurtis?|sarees?|saris?|dress(es)?|gowns?|jeans|trousers|pants|shorts|skirts?|jackets?|coats?|hoodies?|sweaters?|sweatshirts?|blazers?|suits?|lehengas?|dupattas?|jumpsuits?|co-?ords?|leggings|joggers|track ?pants|polos?|shrugs?|cardigans?|tunics?|camisoles?|tank ?tops?|vests?|waistcoats?|sherwanis?|salwars?|churidars?|palazzos?|pyjamas?|pajamas?|nightwear|anarkalis?|dungarees|overalls|rompers?|bodysuits?|swimsuits?|swimwear|jerseys?|parkas?|windcheaters?|clothing|apparel)\b/i;
const NOT_APPAREL_PHRASES =
  /\b(phone case|mobile cover|back cover|stickers?|fabric paint|fabric dye|hangers?|mannequins?|for (dogs|cats|pets)|pet (clothing|apparel|dress)|doll clothes|dress form|sewing pattern|gift card|posters?|mugs?)\b/i;
const NON_APPAREL_ITEMS =
  /\b(shoes?|sneakers?|sandals?|slippers?|heels|boots?|loafers?|flip-?flops?|bags?|backpacks?|handbags?|wallets?|watch(es)?|necklaces?|earrings?|bracelets?|rings?|sunglasses|perfumes?|belts?|caps?|hats?|socks)\b/i;
const CTA_TEXT = /\badd to (shopping )?(cart|bag|basket|trolley)\b|\bbuy now\b/i;
const PRICE = /(₹|rs\.?|inr|\$|€|£|usd|eur|gbp|aed|sar)\s?\d[\d,]*(\.\d{1,2})?/i;
const MIN_IMAGE_AREA = 200 * 200;

function lastMatchIndex(re: RegExp, text: string): number {
  let last = -1;
  for (const m of text.matchAll(new RegExp(re.source, 'gi'))) last = m.index ?? last;
  return last;
}

/**
 * English product titles usually end with the head noun ("Leather Dress Shoes"),
 * so the last garment/non-garment word decides.
 * ponytail: keyword heuristic; add a vision check if false positives show up.
 */
export function isClothing(title: string, context: string): boolean {
  if (NOT_APPAREL_PHRASES.test(title)) return false;
  const apparel = lastMatchIndex(APPAREL, title);
  const other = lastMatchIndex(NON_APPAREL_ITEMS, title);
  if (apparel >= 0) return apparel > other;
  return other < 0 && APPAREL.test(context);
}

export function isVisible(el: Element): boolean {
  if (el.closest('[hidden],[aria-hidden="true"]')) return false;
  for (let e: Element | null = el; e; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
  }
  return true;
}

export function findCta(doc: Document): HTMLElement | null {
  const candidates = doc.querySelectorAll<HTMLElement>('button, input[type="submit"], input[type="button"], a, [role="button"]');
  for (const el of candidates) {
    const label = [el.textContent, el.getAttribute('value'), el.getAttribute('aria-label'), el.getAttribute('title')]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (label.length <= 80 && CTA_TEXT.test(label) && isVisible(el)) return el;
  }
  return null;
}

type LdNode = Record<string, unknown>;

function jsonLdNodes(doc: Document): LdNode[] {
  const out: LdNode[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(visit);
    else if (n && typeof n === 'object') {
      out.push(n as LdNode);
      visit((n as LdNode)['@graph']);
    }
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(s.textContent ?? ''));
    } catch {
      // Malformed JSON-LD is common in the wild; other signals still apply.
    }
  }
  return out;
}

const hasType = (n: LdNode, t: string) => n['@type'] === t || (Array.isArray(n['@type']) && n['@type'].includes(t));

function text(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(text).join(' ');
  if (v && typeof v === 'object' && 'name' in v) return text((v as LdNode).name);
  return '';
}

function imageUrls(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(imageUrls);
  if (v && typeof v === 'object' && 'url' in v) return imageUrls((v as LdNode).url);
  return [];
}

function offerPrice(offers: unknown): string | null {
  const o = (Array.isArray(offers) ? offers[0] : offers) as LdNode | undefined;
  if (!o || typeof o !== 'object') return null;
  const amount = o.price ?? o.lowPrice;
  if (amount === undefined || amount === null || amount === '') return null;
  const currency = typeof o.priceCurrency === 'string' ? `${o.priceCurrency} ` : '';
  return `${currency}${String(amount)}`.slice(0, 40);
}

function findPrice(doc: Document): string | null {
  const amount = doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
  if (amount) {
    const currency = doc.querySelector('meta[property="product:price:currency"]')?.getAttribute('content');
    return `${currency ? `${currency} ` : ''}${amount}`.slice(0, 40);
  }
  const priced = doc.querySelectorAll('[itemprop="price"], [class*="price" i], [id*="price" i], [data-testid*="price" i]');
  for (const el of Array.from(priced).slice(0, 50)) {
    const m = PRICE.exec(el.textContent ?? '');
    if (m && isVisible(el)) return m[0];
  }
  // Obfuscated class names (e.g. Flipkart): scan short text nodes.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(), seen = 0; n && seen < 5000; n = walker.nextNode(), seen++) {
    const t = n.textContent?.trim() ?? '';
    if (t.length < 30 && new RegExp(`^${PRICE.source}$`, 'i').test(t) && n.parentElement && isVisible(n.parentElement)) return t;
  }
  return null;
}

function dedupe(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((u) => {
    const { origin, pathname } = new URL(u);
    const key = origin + pathname;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function detectProduct(doc: Document, pageUrl: string): ProductInfo | null {
  const nodes = jsonLdNodes(doc);
  const ld = nodes.find((n) => hasType(n, 'Product') || hasType(n, 'ProductGroup'));
  const meta = (name: string) =>
    doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')?.trim() || null;

  const price = (ld ? offerPrice(ld.offers) : null) ?? findPrice(doc);
  const ogProduct = meta('og:type')?.toLowerCase().includes('product') || meta('product:price:amount') !== null;
  const score = (ld ? 2 : 0) + (ogProduct ? 1 : 0) + (findCta(doc) ? 1 : 0) + (price ? 1 : 0);
  if (score < 2) return null;

  const h1 = Array.from(doc.querySelectorAll('h1'), (h) => h.textContent?.trim() ?? '').join(' ');
  const title = (text(ld?.name) || meta('og:title') || h1 || doc.title).replace(/\s+/g, ' ').trim().slice(0, 300);
  const crumbs = Array.from(
    doc.querySelectorAll('nav[aria-label*="breadcrumb" i], [class*="breadcrumb" i], [id*="breadcrumb" i]'),
    (e) => e.textContent ?? '',
  ).join(' ');
  const ldCrumbs = nodes.filter((n) => hasType(n, 'BreadcrumbList')).map((n) => JSON.stringify(n.itemListElement ?? ''));
  const context = [text(ld?.category), crumbs.slice(0, 2000), ldCrumbs.join(' ').slice(0, 2000), h1, meta('og:title') ?? ''].join(' ');
  if (!isClothing(title, context)) return null;

  // ponytail: "largest visible image on the page"; scope to the h1's container if banners get picked.
  const pageImages = Array.from(doc.querySelectorAll('img'))
    .filter((img) => imageArea(img) >= MIN_IMAGE_AREA && isVisible(img))
    .sort((a, b) => imageArea(b) - imageArea(a))
    .map((img) => bestImageUrl(img, pageUrl));
  const candidates = [...imageUrls(ld?.image).map((u) => toHttpsUrl(u, pageUrl)), toHttpsUrl(meta('og:image'), pageUrl), ...pageImages];
  const images = dedupe(candidates.filter((u): u is string => u !== null));

  return {
    url: pageUrl,
    title,
    price,
    storeName: (meta('og:site_name') ?? new URL(pageUrl).hostname.replace(/^www\./, '')).slice(0, 100),
    garmentImage: images[0] ?? null,
    gallery: images.slice(1, 9),
  };
}

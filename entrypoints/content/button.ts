import { findCta } from '@/lib/detect';
import { FALLBACK_THEME, buttonTheme } from '@/lib/theme';

const SHIRT_PATH =
  'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z';

const CSS = `
:host { all: initial; }
:host(.inline) { display: block; margin: 8px 0; }
:host(.floating) { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; }
button {
  all: initial; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; min-width: 140px; height: var(--h); padding: 0 20px; cursor: pointer;
  background: var(--bg); color: var(--fg); border-radius: var(--radius);
  font-family: var(--font); font-size: var(--size); font-weight: 600; transition: filter .15s;
}
:host(.floating) button { width: auto; box-shadow: 0 6px 20px rgba(0, 0, 0, .25); }
button:hover { filter: brightness(1.08); }
button:focus-visible { outline: 3px solid var(--fg); outline-offset: 2px; }
svg { width: 18px; height: 18px; flex: none; }`;

/** The CTA plus wrappers that share its visual box (e.g. Amazon's input inside .a-button). */
function sameBoxChain(cta: Element, maxDepth = 5): Element[] {
  const chain = [cta];
  const r = cta.getBoundingClientRect();
  if (r.width === 0) return chain;
  let el = cta.parentElement;
  for (let i = 0; el && el !== el.ownerDocument.body && i < maxDepth; i++, el = el.parentElement) {
    const p = el.getBoundingClientRect();
    if (Math.abs(p.width - r.width) > 4 || Math.abs(p.height - r.height) > 4) break;
    chain.push(el);
  }
  return chain;
}

function shirtIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', SHIRT_PATH);
  svg.append(path);
  return svg;
}

export function mountButton(doc: Document, onClick: () => void): { host: HTMLElement; remove(): void } {
  const cta = findCta(doc);
  const chain = cta ? sameBoxChain(cta) : [];
  const theme = cta ? buttonTheme(chain) : FALLBACK_THEME;

  const host = doc.createElement('virtual-tryon-button');
  host.className = cta ? 'inline' : 'floating';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = CSS;

  const button = doc.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Virtual try-on: see yourself wearing this item');
  button.style.setProperty('--bg', theme.background);
  button.style.setProperty('--fg', theme.color);
  button.style.setProperty('--radius', theme.borderRadius);
  button.style.setProperty('--font', theme.fontFamily);
  button.style.setProperty('--size', theme.fontSize);
  button.style.setProperty('--h', `${theme.height}px`);
  button.append(shirtIcon(doc), doc.createTextNode('Try On'));
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  shadow.append(style, button);

  if (cta) {
    const anchor = chain[chain.length - 1]!;
    const width = anchor.getBoundingClientRect().width;
    if (width > 0) host.style.maxWidth = `${Math.round(width)}px`;
    anchor.insertAdjacentElement('afterend', host);
  } else {
    doc.body.append(host);
  }
  return { host, remove: () => host.remove() };
}

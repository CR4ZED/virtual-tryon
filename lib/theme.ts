export interface ButtonTheme {
  background: string;
  color: string;
  borderRadius: string;
  fontFamily: string;
  fontSize: string;
  height: number;
}

export const FALLBACK_THEME: ButtonTheme = {
  background: 'rgb(17, 24, 39)',
  color: 'rgb(255, 255, 255)',
  borderRadius: '8px',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: '14px',
  height: 44,
};

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

export function parseColor(c: string): [number, number, number, number] | null {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(c.trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
}

function luminance(rgb: number[]): number {
  const r = rgb[0]!;
  const g = rgb[1]!;
  const b = rgb[2]!;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: number[], b: number[]): number {
  const lums = [luminance(a), luminance(b)].sort((x, y) => y - x);
  const [hi, lo] = lums as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Copies the first opaque element's look from the CTA's same-box wrapper chain (inner to outer). */
export function buttonTheme(chain: Element[], getStyle: (el: Element) => CSSStyleDeclaration = (el) => getComputedStyle(el)): ButtonTheme {
  for (const el of chain) {
    const s = getStyle(el);
    const bg = parseColor(s.backgroundColor ?? '');
    if (!bg || bg[3] < 0.5) continue;
    const fg = parseColor(s.color ?? '');
    const color =
      fg && contrastRatio(bg, fg) >= 4.5
        ? s.color
        : contrastRatio(bg, WHITE) >= contrastRatio(bg, BLACK)
          ? 'rgb(255, 255, 255)'
          : 'rgb(0, 0, 0)';
    const height = Math.min(56, Math.max(36, Math.round(el.getBoundingClientRect().height) || FALLBACK_THEME.height));
    return {
      background: s.backgroundColor,
      color,
      borderRadius: s.borderRadius || FALLBACK_THEME.borderRadius,
      fontFamily: s.fontFamily || FALLBACK_THEME.fontFamily,
      fontSize: s.fontSize || FALLBACK_THEME.fontSize,
      height,
    };
  }
  return FALLBACK_THEME;
}

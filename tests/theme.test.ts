import { describe, expect, it } from 'vitest';
import { FALLBACK_THEME, buttonTheme, contrastRatio, parseColor } from '@/lib/theme';

const style = (o: Partial<CSSStyleDeclaration>) => o as CSSStyleDeclaration;

describe('parseColor', () => {
  it('parses legacy and modern rgb syntax', () => {
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3, 1]);
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3, 0.5]);
    expect(parseColor('rgb(1 2 3 / 50%)')).toEqual([1, 2, 3, 0.5]);
    expect(parseColor('oklch(0.7 0.1 30)')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
  });
});

describe('buttonTheme', () => {
  it('copies the CTA look', () => {
    const el = document.createElement('button');
    const theme = buttonTheme([el], () =>
      style({ backgroundColor: 'rgb(255, 216, 20)', color: 'rgb(15, 17, 17)', borderRadius: '20px', fontFamily: 'Amazon Ember, Arial', fontSize: '13px' }),
    );
    expect(theme).toEqual({
      background: 'rgb(255, 216, 20)',
      color: 'rgb(15, 17, 17)',
      borderRadius: '20px',
      fontFamily: 'Amazon Ember, Arial',
      fontSize: '13px',
      height: 44,
    });
  });

  it('skips transparent wrappers and fixes low-contrast text', () => {
    const inner = document.createElement('span');
    const outer = document.createElement('span');
    const theme = buttonTheme([inner, outer], (e) =>
      e === inner
        ? style({ backgroundColor: 'rgba(0, 0, 0, 0)', color: 'rgb(0, 0, 0)' })
        : style({ backgroundColor: 'rgb(255, 82, 0)', color: 'rgb(255, 120, 40)', borderRadius: '4px', fontFamily: 'Inter', fontSize: '14px' }),
    );
    expect(theme.background).toBe('rgb(255, 82, 0)');
    expect(theme.color).toBe('rgb(0, 0, 0)');
  });

  it('falls back when no usable background is found', () => {
    const el = document.createElement('button');
    expect(buttonTheme([el], () => style({ backgroundColor: 'oklch(0.7 0.1 30)' }))).toEqual(FALLBACK_THEME);
    expect(buttonTheme([])).toEqual(FALLBACK_THEME);
  });
});

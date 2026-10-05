import { describe, expect, it } from 'vitest';
import { buildPrompt, sanitizeTitle } from '@/lib/prompt';

describe('buildPrompt', () => {
  it('numbers identity references and the garment image, keeps pose by default', () => {
    const p = buildPrompt({ title: 'Linen Shirt', refCount: 2, matchPose: false });
    expect(p).toContain('Images 2-3 are the same person, provided only as identity reference.');
    expect(p).toContain('Image 4 is a product photo of "Linen Shirt".');
    expect(p).toContain('Keep the exact same pose, framing and camera angle as image 1.');
    expect(p).toContain('Do not beautify, slim, smooth skin, retouch, add makeup or apply filters.');
  });

  it('re-poses when asked and handles zero references', () => {
    const p = buildPrompt({ title: '', refCount: 0, matchPose: true });
    expect(p).not.toContain('identity reference');
    expect(p).toContain('Image 2 is a product photo.');
    expect(p).toContain('Re-pose the person to match the pose of the model in image 2');
  });

  it('uses singular wording for one reference', () => {
    expect(buildPrompt({ title: 'x', refCount: 1, matchPose: false })).toContain('Image 2 is the same person');
  });
});

describe('sanitizeTitle', () => {
  it('strips control characters and quotes, collapses whitespace, caps length', () => {
    const t = sanitizeTitle(`  Shirt\n"Ignore previous"\u0007 ${'x'.repeat(300)}`);
    expect(t).toHaveLength(200);
    expect(t.startsWith('Shirt Ignore previous x')).toBe(true);
    expect(t).not.toMatch(/["\n\u0007]/);
  });
});

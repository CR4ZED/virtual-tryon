export function sanitizeTitle(title: string): string {
  return title
    .replace(/[\u0000-\u001f\u007f"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function buildPrompt({ title, refCount, matchPose }: { title: string; refCount: number; matchPose: boolean }): string {
  const garment = refCount + 2;
  const refs =
    refCount === 0
      ? ''
      : refCount === 1
        ? ' Image 2 is the same person, provided only as identity reference.'
        : ` Images 2-${refCount + 1} are the same person, provided only as identity reference.`;
  const name = sanitizeTitle(title);
  return [
    `Image 1 is the person.${refs} Image ${garment} is a product photo${name ? ` of "${name}"` : ''}.`,
    `Dress the person from image 1 in the garment shown in image ${garment}. Reproduce the garment's exact color, pattern, print, fabric texture, neckline, sleeves, length and fit. Use only the garment; ignore the product model's face, body, pose and background.`,
    'Preserve exactly: face, facial features, expression, skin tone and texture including blemishes and marks, hair, body shape, weight, height, proportions, hands, background and lighting. Do not beautify, slim, smooth skin, retouch, add makeup or apply filters. Do not change apparent age, gender or ethnicity. Replace only the clothing the garment replaces; keep all other clothing. Photorealistic result with natural fabric folds and shadows matching the original lighting.',
    matchPose
      ? `Re-pose the person to match the pose of the model in image ${garment}, while keeping every physical trait above unchanged.`
      : 'Keep the exact same pose, framing and camera angle as image 1.',
  ].join('\n\n');
}

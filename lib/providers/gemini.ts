import { base64ToBlob, blobToBase64 } from '../imageProcessing';
import { REFUSED_MESSAGE, TryOnError, httpError, readErrorMessage, type FetchFn, type GenerateInput } from './common';

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export async function generateGemini(input: GenerateInput, fetchFn: FetchFn = fetch): Promise<Blob> {
  const images = await Promise.all(
    input.images.map(async (b) => ({ type: 'image', mime_type: b.type || 'image/jpeg', data: await blobToBase64(b) })),
  );
  const res = await fetchFn(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': input.apiKey },
    body: JSON.stringify({
      model: input.model,
      input: [...images, { type: 'text', text: input.prompt }],
      response_format: { type: 'image', aspect_ratio: input.aspectRatio },
    }),
    signal: input.signal,
  });
  if (!res.ok) throw httpError('Gemini', res.status, await readErrorMessage(res));
  return parseGeminiResponse(await res.json());
}

interface Step {
  type?: unknown;
  content?: Array<{ type?: unknown; data?: unknown; mime_type?: unknown }>;
}

export function parseGeminiResponse(body: unknown): Blob {
  const steps = (body as { steps?: Step[] } | null)?.steps;
  for (const step of Array.isArray(steps) ? steps : []) {
    if (step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const c of step.content) {
      if (c.type === 'image' && typeof c.data === 'string') {
        return base64ToBlob(c.data, typeof c.mime_type === 'string' ? c.mime_type : 'image/png');
      }
    }
  }
  throw new TryOnError('refused', REFUSED_MESSAGE);
}

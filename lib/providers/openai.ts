import { base64ToBlob } from '../imageProcessing';
import { REFUSED_MESSAGE, TryOnError, httpError, readErrorMessage, type FetchFn, type GenerateInput } from './common';

export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/images/edits';

// gpt-image-2 and later always use high input fidelity and reject the parameter.
const SUPPORTS_INPUT_FIDELITY = /^gpt-image-1(\.5)?(-\d{4}-\d{2}-\d{2})?$/;

export function buildOpenAIForm(input: Pick<GenerateInput, 'model' | 'prompt' | 'images'>): FormData {
  const form = new FormData();
  form.append('model', input.model);
  form.append('prompt', input.prompt);
  input.images.forEach((b, i) => form.append('image[]', b, `image-${i + 1}.jpg`));
  form.append('size', 'auto');
  form.append('quality', 'high');
  form.append('output_format', 'png');
  if (SUPPORTS_INPUT_FIDELITY.test(input.model)) form.append('input_fidelity', 'high');
  return form;
}

export async function generateOpenAI(input: GenerateInput, fetchFn: FetchFn = fetch): Promise<Blob> {
  const res = await fetchFn(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body: buildOpenAIForm(input),
    signal: input.signal,
  });
  if (!res.ok) throw httpError('OpenAI', res.status, await readErrorMessage(res));
  return parseOpenAIResponse(await res.json());
}

export function parseOpenAIResponse(body: unknown): Blob {
  const b64 = (body as { data?: Array<{ b64_json?: unknown }> } | null)?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') throw new TryOnError('refused', REFUSED_MESSAGE);
  return base64ToBlob(b64, 'image/png');
}

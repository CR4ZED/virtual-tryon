import { getCart, referencedResultIds } from './cart';
import { getSettings, listPhotos, saveResult, type ResultRecord } from './db';
import { fetchGarment } from './garment';
import { nearestAspectRatio, normalizeImage } from './imageProcessing';
import { buildPrompt } from './prompt';
import { TryOnError, type GenerateInput } from './providers/common';
import { generateGemini } from './providers/gemini';
import { generateOpenAI } from './providers/openai';

export interface TryOnRequest {
  productUrl: string;
  garmentUrl: string;
  title: string;
  /** null means "use the primary photo". */
  basePhotoId: string | null;
  matchPose: boolean;
}

export const TIMEOUT_MS = 90_000;

export async function runTryOn(req: TryOnRequest, signal: AbortSignal): Promise<ResultRecord> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = AbortSignal.any([signal, timeout]);
  let providerName = 'the provider';
  try {
    const settings = await getSettings();
    providerName = settings.provider === 'gemini' ? 'Gemini' : 'OpenAI';
    const apiKey = settings.provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
    if (!apiKey) throw new TryOnError('auth', `Add your ${providerName} API key in Settings.`);

    const photos = await listPhotos();
    const base = photos.find((p) => p.id === req.basePhotoId) ?? photos.find((p) => p.primary);
    if (!base) throw new TryOnError('no_photos', 'Upload a photo of yourself in Settings first.');
    const refs = photos.filter((p) => p.id !== base.id).slice(0, 3);

    if (signal.aborted) throw new TryOnError('cancelled', 'Cancelled.');
    const raw = await fetchGarment(req.garmentUrl, combined);
    const garment = await normalizeImage(raw).catch(() => {
      throw new TryOnError('garment', 'The product image could not be decoded. Use "Pick image" to choose another photo.');
    });
    const input: GenerateInput = {
      apiKey,
      model: settings.provider === 'gemini' ? settings.geminiModel : settings.openaiModel,
      prompt: buildPrompt({ title: req.title, refCount: refs.length, matchPose: req.matchPose }),
      images: [base.blob, ...refs.map((r) => r.blob), garment.blob],
      aspectRatio: nearestAspectRatio(base.width, base.height),
      signal: combined,
    };
    const blob = settings.provider === 'gemini' ? await generateGemini(input) : await generateOpenAI(input);
    const keep = referencedResultIds(await getCart());
    return await saveResult({ blob, productUrl: req.productUrl, basePhotoId: base.id, matchPose: req.matchPose, provider: settings.provider }, keep);
  } catch (e) {
    if (signal.aborted) throw new TryOnError('cancelled', 'Cancelled.');
    if (timeout.aborted) throw new TryOnError('timeout', `${providerName} took longer than 90 seconds. Try again.`);
    if (e instanceof TryOnError) throw e;
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new TryOnError('storage', 'Browser storage is full. Delete old data in Settings.');
    }
    if (e instanceof TypeError) throw new TryOnError('provider', `Network error while contacting ${providerName}. Check your connection.`);
    throw new TryOnError('provider', e instanceof Error ? e.message : 'Something went wrong.');
  }
}

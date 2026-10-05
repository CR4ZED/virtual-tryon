import { useRef, useState } from 'react';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { usePhotos } from '@/hooks/useData';
import { addPhoto, deletePhoto, setPrimaryPhoto, type PhotoRecord } from '@/lib/db';
import { normalizeImage } from '@/lib/imageProcessing';
import { MAX_PHOTOS, MIN_PHOTO_SHORT_EDGE, validateUpload } from '@/lib/validate';

function PhotoTile({ photo }: { photo: PhotoRecord }) {
  const url = useObjectUrl(photo.blob);
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted">
      {url && <img src={url} alt="Your photo" className="aspect-[3/4] w-full object-cover" />}
      {photo.primary && <Badge className="absolute left-2 top-2">Primary</Badge>}
      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-2">
        {!photo.primary && (
          <Button size="icon" variant="secondary" className="size-8" aria-label="Make primary" onClick={() => void setPrimaryPhoto(photo.id)}>
            <Star className="size-4" />
          </Button>
        )}
        <Button size="icon" variant="destructive" className="size-8" aria-label="Delete photo" onClick={() => void deletePhoto(photo.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function PhotosCard() {
  const photos = usePhotos() ?? [];
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: string[] = [];
    try {
      let count = photos.length;
      for (const file of Array.from(files)) {
        if (count >= MAX_PHOTOS) {
          out.push(`${file.name}: you can store up to ${MAX_PHOTOS} photos.`);
          continue;
        }
        const check = await validateUpload(file);
        if (!check.ok) {
          out.push(`${file.name}: ${check.error}`);
          continue;
        }
        let img;
        try {
          img = await normalizeImage(file);
        } catch {
          out.push(`${file.name}: this image could not be read.`);
          continue;
        }
        if (Math.min(img.width, img.height) < MIN_PHOTO_SHORT_EDGE) out.push(`${file.name}: low resolution, results may look blurry.`);
        try {
          await addPhoto(img.blob, img.width, img.height);
          count++;
        } catch (e) {
          out.push(`${file.name}: ${e instanceof Error && /photos/.test(e.message) ? e.message : 'could not be saved.'}`);
        }
      }
    } finally {
      setMessages(out);
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your photos</CardTitle>
        <CardDescription>
          Add 1–{MAX_PHOTOS} photos. The primary photo is dressed; the others help the AI keep your face and body exactly as they are.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} />
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
            >
              <ImagePlus className="size-6" />
              <span className="text-sm">{busy ? 'Processing…' : 'Add photo'}</span>
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        {messages.length > 0 && (
          <Alert>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <ul className="text-muted-foreground grid gap-1 text-sm">
          <li>• Full body, head to feet, facing the camera, standing straight.</li>
          <li>• Even daylight, plain background, no other people.</li>
          <li>• Fitted clothing so your body shape is visible; no bags or coats covering you.</li>
          <li>• JPEG, PNG or WebP, up to 10 MB each. Photos are resized to 1536 px and location data is removed.</li>
        </ul>
      </CardContent>
    </Card>
  );
}

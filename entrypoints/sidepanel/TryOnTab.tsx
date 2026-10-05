import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, Download, Loader2, RefreshCw, Settings, ShoppingBag, Sparkles, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { usePhotos, useSettings } from '@/hooks/useData';
import { addToCart, getCart, onCartChanged, type CartItem } from '@/lib/cart';
import { latestResultFor, type PhotoRecord, type ResultRecord } from '@/lib/db';
import { TryOnError } from '@/lib/providers/common';
import { runTryOn } from '@/lib/tryon';
import { cn } from '@/lib/utils';
import { CompareSlider } from './CompareSlider';
import { useActiveTab, useProduct } from './hooks';

type Status = { kind: 'idle' } | { kind: 'running'; startedAt: number } | { kind: 'error'; error: TryOnError };

const openSettings = () => void browser.runtime.openOptionsPage();

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{Math.floor((now - since) / 1000)}s</>;
}

function PhotoThumb({ photo, selected, onSelect }: { photo: PhotoRecord; selected: boolean; onSelect: () => void }) {
  const url = useObjectUrl(photo.blob);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={photo.primary ? 'Primary photo' : 'Photo'}
      className={cn('overflow-hidden rounded-md border-2', selected ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}
    >
      {url && <img src={url} alt="" className="aspect-[3/4] w-14 object-cover" />}
    </button>
  );
}

function download(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `try-on-${Date.now()}.${blob.type === 'image/jpeg' ? 'jpg' : 'png'}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="grid gap-3 py-6 text-center">
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground grid justify-items-center gap-3 text-sm">{children}</div>
      </CardContent>
    </Card>
  );
}

export function TryOnTab() {
  const tab = useActiveTab();
  const { product, garmentUrl, setGarmentUrl, reachable, startPicker } = useProduct(tab);
  const photos = usePhotos();
  const settings = useSettings();
  const [baseId, setBaseId] = useState<string | null>(null);
  const [matchPose, setMatchPose] = useState(false);
  const [result, setResult] = useState<ResultRecord | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [cartItem, setCartItem] = useState<CartItem | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const productUrlRef = useRef(product?.url);
  productUrlRef.current = product?.url;

  const base = photos?.find((p) => p.id === baseId) ?? photos?.find((p) => p.primary) ?? null;
  const resultBase = photos?.find((p) => p.id === result?.basePhotoId) ?? base;
  const beforeUrl = useObjectUrl(resultBase?.blob);
  const afterUrl = useObjectUrl(result?.blob);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    // A running generation keeps going across product changes; its result is saved by runTryOn.
    setResult(null);
    setStatus((s) => (s.kind === 'running' ? s : { kind: 'idle' }));
    let live = true;
    if (product) void latestResultFor(product.url).then((r) => live && setResult(r ?? null));
    return () => {
      live = false;
    };
  }, [product?.url]);
  useEffect(() => {
    const url = product?.url.split('#', 1)[0];
    const sync = (items: CartItem[]) => setCartItem(items.find((i) => i.productUrl === url) ?? null);
    let live = true;
    void getCart().then((items) => live && sync(items));
    const off = onCartChanged(sync);
    return () => {
      live = false;
      off();
    };
  }, [product?.url]);

  if (!photos || !settings) return null;

  if (photos.length === 0) {
    return (
      <Message title="Add your photo to get started">
        <p>Upload 1–4 clear, full-body photos. They never leave your browser except to the AI provider you choose.</p>
        <Button onClick={openSettings}>
          <Settings className="size-4" /> Open settings
        </Button>
      </Message>
    );
  }

  if (!product) {
    const isWebPage = tab ? /^https:/.test(tab.url) : false;
    return (
      <Message title={isWebPage ? 'No clothing item detected on this page' : 'Open a clothing product page'}>
        {isWebPage && reachable === true && (
          <>
            <p>Pick the product photo yourself to try it on.</p>
            <Button variant="outline" onClick={startPicker}>
              <Crosshair className="size-4" /> Pick image
            </Button>
          </>
        )}
        {isWebPage && reachable === false && tab && (
          <>
            <p>This tab was opened before the extension was installed.</p>
            <Button variant="outline" onClick={() => void browser.tabs.reload(tab.id)}>
              <RefreshCw className="size-4" /> Reload page
            </Button>
          </>
        )}
      </Message>
    );
  }

  const apiKey = settings.provider === 'gemini' ? settings.geminiKey : settings.openaiKey;
  const providerName = settings.provider === 'gemini' ? 'Gemini' : 'OpenAI';
  const running = status.kind === 'running';
  const inCart = !!cartItem;
  const canUpdateCart = !!(result && cartItem && cartItem.resultId !== result.id);
  const cartLabel = canUpdateCart ? 'Update cart' : inCart ? 'In cart' : 'Add to cart';
  const thumbnails = [...new Set([product.garmentImage, ...product.gallery, garmentUrl].filter((u): u is string => !!u))];

  async function generate() {
    if (!product || !garmentUrl || !base) return;
    const forUrl = product.url;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus({ kind: 'running', startedAt: Date.now() });
    try {
      const rec = await runTryOn({ productUrl: product.url, garmentUrl, title: product.title, basePhotoId: base.id, matchPose }, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (productUrlRef.current === forUrl) setResult(rec);
      setStatus({ kind: 'idle' });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      if (productUrlRef.current !== forUrl) return setStatus({ kind: 'idle' });
      const error = e instanceof TryOnError ? e : new TryOnError('provider', 'Something went wrong.');
      setStatus(error.kind === 'cancelled' ? { kind: 'idle' } : { kind: 'error', error });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  async function onAddToCart() {
    if (!product) return;
    try {
      await addToCart({
        storeName: product.storeName,
        title: product.title,
        price: product.price,
        productImageUrl: garmentUrl,
        productUrl: product.url,
        resultId: result?.id ?? null,
      });
    } catch {
      setStatus({ kind: 'error', error: new TryOnError('storage', 'Could not add to cart.') });
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 pt-4">
          {garmentUrl && <img src={garmentUrl} alt="Selected product" className="h-56 w-full rounded-md bg-muted object-contain" />}
          <div>
            <p className="line-clamp-2 font-medium leading-snug">{product.title}</p>
            <p className="text-muted-foreground text-sm">
              {product.storeName}
              {product.price && ` · ${product.price}`}
            </p>
          </div>
          {thumbnails.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Other product images">
              {thumbnails.map((url) => (
                <button
                  key={url}
                  type="button"
                  role="listitem"
                  onClick={() => setGarmentUrl(url)}
                  aria-pressed={url === garmentUrl}
                  className={cn('shrink-0 overflow-hidden rounded-md border-2', url === garmentUrl ? 'border-primary' : 'border-transparent')}
                >
                  <img src={url} alt="" className="size-14 bg-muted object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={startPicker}>
              <Crosshair className="size-4" /> Pick image
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => void onAddToCart()} disabled={inCart && !canUpdateCart}>
              {inCart && !canUpdateCart ? <Check className="size-4" /> : <ShoppingBag className="size-4" />} {cartLabel}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        <Label>Your photo</Label>
        <div className="flex gap-2">
          {photos.map((p) => (
            <PhotoThumb key={p.id} photo={p} selected={p.id === base?.id} onSelect={() => setBaseId(p.id)} />
          ))}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="grid gap-1">
          <Label htmlFor="match-pose">Match model's pose</Label>
          <p className="text-muted-foreground text-xs">Off keeps your exact pose, which gives the cleanest before/after comparison.</p>
        </div>
        <Switch id="match-pose" checked={matchPose} onCheckedChange={setMatchPose} />
      </div>

      {!apiKey && (
        <Alert>
          <AlertTitle>Add your {providerName} API key</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={openSettings}>
              Open settings
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {running ? (
        <div className="flex gap-2">
          <Button className="flex-1" disabled>
            <Loader2 className="size-4 animate-spin" /> Generating… <Elapsed since={status.startedAt} />
          </Button>
          <Button variant="outline" onClick={() => {
              abortRef.current?.abort();
              setStatus({ kind: 'idle' });
            }}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => void generate()} disabled={!apiKey || !garmentUrl || !base}>
          <Sparkles className="size-4" /> {result ? 'Try on again' : 'Try it on'}
        </Button>
      )}

      {status.kind === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't create the try-on</AlertTitle>
          <AlertDescription className="grid gap-2">
            <p>{status.error.message}</p>
            <div>
              {status.error.kind === 'auth' || status.error.kind === 'no_photos' || status.error.kind === 'storage' ? (
                <Button size="sm" variant="outline" onClick={openSettings}>
                  Open settings
                </Button>
              ) : status.error.kind === 'garment' ? (
                <Button size="sm" variant="outline" onClick={startPicker}>
                  Pick image
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void generate()}>
                  Retry
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {result && beforeUrl && afterUrl && resultBase && (
        <div className="grid gap-2">
          <CompareSlider before={beforeUrl} after={afterUrl} aspect={resultBase.width / resultBase.height} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => void generate()} disabled={running}>
              <RefreshCw className="size-4" /> Regenerate
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => download(result.blob)}>
              <Download className="size-4" /> Download
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">AI-generated preview. Fit and color may differ from the real product.</p>
        </div>
      )}
    </div>
  );
}

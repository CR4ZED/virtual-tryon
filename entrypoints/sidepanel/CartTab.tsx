import { useEffect, useState } from 'react';
import { ExternalLink, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { MAX_NOTE, getCart, groupByStore, onCartChanged, removeFromCart, updateCartItem, type CartItem } from '@/lib/cart';
import { getResult } from '@/lib/db';
import { isSafeHttpsUrl } from '@/lib/validate';

const MAX_TABS = 10;

function openTabs(urls: string[]) {
  const safe = urls.filter(isSafeHttpsUrl).slice(0, MAX_TABS);
  if (safe.length > 5 && !confirm(`Open ${safe.length} tabs?`)) return;
  for (const url of safe) void browser.tabs.create({ url, active: false });
}

function ItemRow({ item }: { item: CartItem }) {
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const resultUrl = useObjectUrl(resultBlob);
  useEffect(() => {
    if (item.resultId) void getResult(item.resultId).then((r) => setResultBlob(r?.blob ?? null));
  }, [item.resultId]);
  const image = resultUrl ?? item.productImageUrl;

  return (
    <li className="flex gap-3 py-3">
      {image ? <img src={image} alt="" className="h-20 w-16 shrink-0 rounded-md bg-muted object-cover" /> : <div className="h-20 w-16 shrink-0 rounded-md bg-muted" />}
      <div className="grid min-w-0 flex-1 gap-1.5">
        <button type="button" className="line-clamp-2 text-left text-sm font-medium hover:underline" onClick={() => openTabs([item.productUrl])}>
          {item.title}
        </button>
        {item.price && <p className="text-muted-foreground text-xs">{item.price}</p>}
        <Input
          defaultValue={item.note}
          maxLength={MAX_NOTE}
          placeholder="Size, color…"
          aria-label={`Note for ${item.title}`}
          className="h-8 text-xs"
          onBlur={(e) => e.target.value !== item.note && void updateCartItem(item.id, { note: e.target.value })}
        />
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={item.bought} onCheckedChange={(v) => void updateCartItem(item.id, { bought: v === true })} />
          Bought
        </label>
      </div>
      <Button variant="ghost" size="icon" aria-label={`Remove ${item.title}`} onClick={() => void removeFromCart(item.id)}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

export function CartTab() {
  const [items, setItems] = useState<CartItem[] | null>(null);
  useEffect(() => {
    void getCart().then(setItems);
    return onCartChanged(setItems);
  }, []);

  if (!items) return null;
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground grid justify-items-center gap-2 py-10 text-center text-sm">
          <ShoppingBag className="size-8" />
          <p>Your cart is empty. Add items from any store and check out on each store when you're ready.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {groupByStore(items).map((group) => {
        const pending = group.items.filter((i) => !i.bought);
        return (
          <Card key={group.store}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{group.storeName}</CardTitle>
              <Button size="sm" disabled={pending.length === 0} onClick={() => openTabs(pending.map((i) => i.productUrl))}>
                <ExternalLink className="size-4" /> Shop at {group.storeName} ({pending.length})
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {group.items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { ProductInfo } from '@/lib/detect';
import { parseMessage, parseProduct, type Message } from '@/lib/messages';
import { isSafeHttpsUrl } from '@/lib/validate';

export interface ActiveTab {
  id: number;
  url: string;
  title: string;
  status: string;
}

export function useActiveTab(): ActiveTab | null {
  const [tab, setTab] = useState<ActiveTab | null>(null);
  useEffect(() => {
    const refresh = async () => {
      const [t] = await browser.tabs.query({ active: true, currentWindow: true });
      setTab(t?.id === undefined ? null : { id: t.id, url: t.url ?? '', title: t.title ?? '', status: t.status ?? '' });
    };
    const onUpdated = (_id: number, info: { status?: string; url?: string }) => {
      if (info.status === 'complete' || info.url) void refresh();
    };
    void refresh();
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);
  return tab;
}

/** A page where detection failed but the user picked an image manually. */
function pickedProduct(tab: ActiveTab, garmentImage: string): ProductInfo | null {
  if (!isSafeHttpsUrl(tab.url)) return null;
  return { url: tab.url, title: tab.title.slice(0, 300), price: null, storeName: new URL(tab.url).hostname.replace(/^www\./, ''), garmentImage, gallery: [] };
}

export function useProduct(tab: ActiveTab | null) {
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [garmentUrl, setGarmentUrl] = useState<string | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);

  const prev = useRef<{ id: number; url: string } | null>(null);

  useEffect(() => {
    // A status-only change re-queries without clearing, so there is no flicker and a picked image survives.
    if (prev.current?.id !== tab?.id || prev.current?.url !== tab?.url) {
      setProduct(null);
      setGarmentUrl(null);
      setReachable(null);
    }
    prev.current = tab ? { id: tab.id, url: tab.url } : null;
    if (!tab) return;
    let live = true;
    browser.tabs
      .sendMessage(tab.id, { type: 'getProduct' } satisfies Message)
      .then((raw: unknown) => {
        if (!live) return;
        setReachable(true);
        const p = raw ? parseProduct(raw) : null;
        setProduct((cur) => p ?? cur);
        setGarmentUrl((cur) => cur ?? p?.garmentImage ?? null);
      })
      .catch(() => {
        // No content script: browser page, http page, or tab opened before install.
        // Only conclude that once the page finished loading; before that the script may not be listening yet.
        if (live && tab.status === 'complete') setReachable(false);
      });

    const onMessage = (raw: unknown, sender: { id?: string; tab?: { id?: number } }) => {
      if (sender.id !== browser.runtime.id || sender.tab?.id !== tab.id) return;
      const msg = parseMessage(raw);
      if (msg?.type === 'productChanged') {
        setReachable(true);
        setProduct(msg.product);
        setGarmentUrl(msg.product?.garmentImage ?? null);
      } else if (msg?.type === 'picked') {
        setGarmentUrl(msg.url);
        setProduct((p) => p ?? pickedProduct(tab, msg.url));
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => {
      live = false;
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, [tab?.id, tab?.url, tab?.status]);

  const startPicker = () => {
    if (tab) void browser.tabs.sendMessage(tab.id, { type: 'startPicker' } satisfies Message).catch(() => {});
  };

  return { product, garmentUrl, setGarmentUrl, reachable, startPicker };
}

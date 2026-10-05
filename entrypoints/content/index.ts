import { detectProduct, type ProductInfo } from '@/lib/detect';
import { parseMessage, type Message } from '@/lib/messages';
import { mountButton } from './button';
import { startPicker } from './picker';

const MAX_ATTEMPTS_PER_URL = 10;

export default defineContentScript({
  matches: ['https://*/*'],
  runAt: 'document_idle',
  main(ctx) {
    let product: ProductInfo | null = null;
    let button: ReturnType<typeof mountButton> | null = null;
    let stopPicker: (() => void) | null = null;
    let lastUrl = '';
    let attempts = 0;
    let scheduled = false;

    // No receiver (panel closed) is normal; ignore that rejection.
    const send = (msg: Message) => browser.runtime.sendMessage(msg).catch(() => {});

    function scan() {
      scheduled = false;
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        attempts = 0;
        button?.remove();
        button = null;
      }
      if (button?.host.isConnected) return;
      if (!product && attempts >= MAX_ATTEMPTS_PER_URL) return;
      attempts++;
      const next = detectProduct(document, location.href);
      if (JSON.stringify(next) !== JSON.stringify(product)) {
        product = next;
        void send({ type: 'productChanged', product });
      }
      button?.remove();
      button = product ? mountButton(document, () => void send({ type: 'openPanel' })) : null;
    }

    // Product pages render late and SPAs re-render; rescan at most once per second.
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      ctx.setTimeout(scan, 1000);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.addEventListener(window, 'wxt:locationchange', schedule);
    scan();

    browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
      // Only extension pages (no sender.tab) may command the content script.
      if (sender.id !== browser.runtime.id || sender.tab) return;
      const msg = parseMessage(raw);
      if (msg?.type === 'getProduct') sendResponse(product);
      if (msg?.type === 'startPicker') {
        stopPicker?.();
        stopPicker = startPicker(
          document,
          (url) => void send({ type: 'picked', url }),
          () => (stopPicker = null),
        );
      }
    });

    ctx.onInvalidated(() => {
      observer.disconnect();
      button?.remove();
      stopPicker?.();
    });
  },
});

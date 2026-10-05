import { parseMessage } from '@/lib/messages';

export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

  browser.runtime.onMessage.addListener((raw, sender) => {
    if (sender.id !== browser.runtime.id || sender.tab?.windowId === undefined) return;
    // Call open() synchronously so the user gesture from the page click still applies.
    if (parseMessage(raw)?.type === 'openPanel') {
      browser.sidePanel.open({ windowId: sender.tab.windowId }).catch(console.error);
    }
  });
});

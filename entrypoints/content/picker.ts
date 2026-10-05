import { bestImageUrl, imageElementAt } from '@/lib/images';

export const PICKER_TIMEOUT_MS = 60_000;

const CSS = `
:host { all: initial; }
.layer { position: fixed; inset: 0; z-index: 2147483646; cursor: crosshair; }
.box { position: fixed; display: none; pointer-events: none; z-index: 2147483647; border: 3px solid #6366f1; border-radius: 6px; background: rgba(99, 102, 241, .12); }
.hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147483647; pointer-events: none;
  background: #111827; color: #fff; font: 600 14px system-ui, sans-serif; padding: 10px 16px; border-radius: 999px; box-shadow: 0 6px 20px rgba(0, 0, 0, .3); }`;

const HINT = 'Click the product photo · Esc to cancel';

/**
 * Color-picker-style image chooser. A full-viewport layer swallows clicks so the
 * page's own handlers (links, zoom) never fire; hit-testing looks through it.
 */
export function startPicker(doc: Document, onPick: (url: string) => void, onEnd: () => void): () => void {
  const host = doc.createElement('virtual-tryon-picker');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = CSS;
  const make = (cls: string) => Object.assign(doc.createElement('div'), { className: cls });
  const layer = make('layer');
  const box = make('box');
  const hint = make('hint');
  hint.textContent = HINT;
  shadow.append(style, layer, box, hint);
  doc.documentElement.append(host);

  let target: Element | null = null;
  let stopped = false;

  const onMove = (e: PointerEvent) => {
    target = imageElementAt(doc, e.clientX, e.clientY, host);
    if (!target) {
      box.style.display = 'none';
      return;
    }
    const r = target.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = target ? bestImageUrl(target, doc.baseURI) : null;
    if (!url) {
      hint.textContent = `No image here. ${HINT}`;
      return;
    }
    stop();
    onPick(url);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    stop();
  };

  const timer = setTimeout(stop, PICKER_TIMEOUT_MS);
  layer.addEventListener('pointermove', onMove);
  layer.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey, true);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    doc.removeEventListener('keydown', onKey, true);
    host.remove();
    onEnd();
  }
  return stop;
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountButton } from '@/entrypoints/content/button';
import { PICKER_TIMEOUT_MS, startPicker } from '@/entrypoints/content/picker';

afterEach(() => {
  document.body.innerHTML = '';
  document.querySelectorAll('virtual-tryon-picker').forEach((e) => e.remove());
  vi.useRealTimers();
});

describe('mountButton', () => {
  it('inserts right after the add-to-cart button', () => {
    document.body.innerHTML = '<div><button id="cta">Add to cart</button><p id="next"></p></div>';
    const { host } = mountButton(document, vi.fn());
    expect(host.previousElementSibling?.id).toBe('cta');
    expect(host.nextElementSibling?.id).toBe('next');
  });

  it('floats bottom-right when no CTA exists, and removes cleanly', () => {
    document.body.innerHTML = '<p>No buttons</p>';
    const { host, remove } = mountButton(document, vi.fn());
    expect(host.parentElement).toBe(document.body);
    remove();
    expect(host.isConnected).toBe(false);
  });
});

describe('startPicker', () => {
  it('Escape cancels and removes the overlay', () => {
    const onEnd = vi.fn();
    startPicker(document, vi.fn(), onEnd);
    expect(document.querySelector('virtual-tryon-picker')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEnd).toHaveBeenCalledOnce();
    expect(document.querySelector('virtual-tryon-picker')).toBeNull();
  });

  it('times out after 60 seconds', () => {
    vi.useFakeTimers();
    const onEnd = vi.fn();
    startPicker(document, vi.fn(), onEnd);
    vi.advanceTimersByTime(PICKER_TIMEOUT_MS);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('the returned stop function is idempotent', () => {
    const onEnd = vi.fn();
    const stop = startPicker(document, vi.fn(), onEnd);
    stop();
    stop();
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

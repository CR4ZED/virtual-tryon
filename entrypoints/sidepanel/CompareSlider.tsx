import { useState } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

/** Before on the left, after on the right. A native range input gives drag, keyboard and screen-reader support. */
export function CompareSlider({ before, after, aspect }: { before: string; after: string; aspect: number }) {
  const [pos, setPos] = useState(50);
  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-lg border bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
      style={{ aspectRatio: String(aspect) }}
    >
      <img src={after} alt="You wearing the selected item" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
      <img
        src={before}
        alt="Your original photo"
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow" style={{ left: `${pos}%` }}>
        <div className="absolute left-1/2 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-md">
          <ChevronsLeftRight className="size-4" />
        </div>
      </div>
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Before</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">After</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

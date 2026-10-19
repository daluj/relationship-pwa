import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { Moment } from '@/domain/types';
import { MomentCard } from './MomentCard';

interface Props {
  moments: Moment[];
  /** Called when the user nears the end and more may exist (infinite scroll). */
  onEndReached?: () => void;
  showPinned?: boolean;
}

/** Virtualized moment list (SPEC §6.9). */
export function Feed({ moments, onEndReached, showPinned }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => setOffset(listRef.current?.offsetTop ?? 0), []);

  const virtualizer = useWindowVirtualizer({
    count: moments.length,
    estimateSize: () => 140,
    overscan: 6,
    scrollMargin: offset,
  });
  const items = virtualizer.getVirtualItems();
  const lastIndex = items.at(-1)?.index ?? -1;

  useEffect(() => {
    if (onEndReached && lastIndex >= moments.length - 5) onEndReached();
  }, [lastIndex, moments.length, onEndReached]);

  return (
    <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
      {items.map((item) => {
        const m = moments[item.index]!;
        return (
          <div
            key={m.id}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
          >
            <MomentCard moment={m} showPinned={showPinned} />
          </div>
        );
      })}
    </div>
  );
}

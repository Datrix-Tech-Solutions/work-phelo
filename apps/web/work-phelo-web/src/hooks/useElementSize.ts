import { useEffect, useRef, useState } from 'react';

/**
 * Measures an element so a chart can be given an explicit width and height. MUI x-charts'
 * responsive wrapper under-measures a `flex: 1` parent and leaves dead space inside a card.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

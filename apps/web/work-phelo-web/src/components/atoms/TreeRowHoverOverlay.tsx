import { cardClass } from '@/lib/utils';

/** Same glass fade-in used for DataTable row hovers, scaled down to tree rows. Render inside
 *  a `relative group/row` ancestor — the fade triggers on that group's hover state. */
export function TreeRowHoverOverlay() {
  return (
    <div
      className={cardClass(
        'absolute inset-0.5 rounded-lg bg-(--table-header-bg,var(--color-gray-200)) opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 pointer-events-none',
        'glass',
      )}
    />
  );
}

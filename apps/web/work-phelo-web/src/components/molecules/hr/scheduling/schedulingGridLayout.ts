const NAME_COLUMN_WIDTH = 180;

/** Column sizing shared by the scheduling grid and its skeleton. */
export function getSchedulingGridLayout(columns: number) {
  const minDayWidth = columns > 7 ? 80 : 117;
  return {
    gridTemplateColumns: `${NAME_COLUMN_WIDTH}px repeat(${columns}, minmax(${minDayWidth}px, 1fr))`,
    minWidth: NAME_COLUMN_WIDTH + columns * minDayWidth,
  };
}

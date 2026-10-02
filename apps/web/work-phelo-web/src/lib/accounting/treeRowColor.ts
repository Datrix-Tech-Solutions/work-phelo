/** Selected-row tint per folder color, so a selected row stays tinted the same hue as the
 *  type folder it lives under (e.g. Asset's blue folder selects to a light blue row). */
const SELECTED_TINTS: Record<string, string> = {
  'text-blue-500': 'bg-blue-200',
  'text-red-500': 'bg-red-200',
  'text-purple-500': 'bg-purple-200',
  'text-green-500': 'bg-green-200',
  'text-orange-500': 'bg-orange-200',
};

/** Background class for a selected tree row of the given folder color, falling back to a
 *  neutral tint for any color with no dedicated mapping. */
export function getSelectedRowTint(color: string): string {
  return SELECTED_TINTS[color] ?? 'bg-gray-100';
}

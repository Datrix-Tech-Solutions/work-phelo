import { Transform } from 'class-transformer';

export const CollapseWhitespaceString = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  );

export const OptionalCollapseWhitespaceString = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string') return value;
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.length > 0 ? normalized : undefined;
  });

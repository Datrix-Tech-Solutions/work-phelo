import { BadRequestException } from '@nestjs/common';

export const canonicalUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
function decode(cursor: string): unknown[] {
  try {
    if (typeof cursor !== 'string' || cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new Error();
    const bytes = Buffer.from(cursor, 'base64url');
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(value) || encode(value) !== cursor || value[0] !== 1) throw new Error();
    return value;
  } catch {
    throw new BadRequestException();
  }
}
export function listCursor(row: { createdAt: Date; id: string }): string {
  return encode([1, row.createdAt.toISOString(), row.id]);
}
export function listPosition(cursor?: string) {
  if (cursor === undefined) return undefined;
  const value = decode(cursor);
  if (
    value.length !== 3 ||
    typeof value[1] !== 'string' ||
    typeof value[2] !== 'string' ||
    !canonicalUuid.test(value[2])
  )
    throw new BadRequestException();
  const createdAt = new Date(value[1]);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value[1]) ||
    !Number.isFinite(createdAt.getTime()) ||
    createdAt.getUTCFullYear() < 1 ||
    createdAt.toISOString() !== value[1]
  )
    throw new BadRequestException();
  return { createdAt, id: value[2] };
}
export const messageCursor = (sequence: number) => encode([1, sequence]);
export function messagePosition(cursor?: string): number {
  if (cursor === undefined) return 0;
  const value = decode(cursor);
  if (
    value.length !== 2 ||
    typeof value[1] !== 'number' ||
    !Number.isInteger(value[1]) ||
    value[1] < 1 ||
    value[1] > 2147483647
  )
    throw new BadRequestException();
  return value[1];
}

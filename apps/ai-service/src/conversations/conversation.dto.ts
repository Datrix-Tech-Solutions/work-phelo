import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { Request } from 'express';
import { readCapturedRequest } from '../request-integrity/raw-request';

export class CreateConversationDto {}
export class AppendConversationMessageDto {
  @IsString() @MinLength(1) content!: string;
}
export class ConversationPageDto {
  @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(256) @Matches(/^[A-Za-z0-9_-]+$/) cursor?: string;
}
export function conversationBody<T extends object>(request: Request, type: new () => T): T {
  const captured = readCapturedRequest(request);
  if (captured.headers['content-type'] !== 'application/json; charset=utf-8')
    throw new UnsupportedMediaTypeException();
  let value: unknown;
  try {
    if (!Buffer.from(captured.body.toString('utf8'), 'utf8').equals(captured.body))
      throw new Error();
    value = JSON.parse(captured.body.toString('utf8'));
  } catch {
    throw new BadRequestException();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException();
  const dto = plainToInstance(type, value);
  if (
    validateSync(dto, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: false })
      .length
  )
    throw new BadRequestException();
  if (
    dto instanceof AppendConversationMessageDto &&
    (Buffer.byteLength(dto.content, 'utf8') > 16384 ||
      Buffer.from(dto.content).toString('utf8') !== dto.content)
  )
    throw new BadRequestException();
  return dto;
}
export function idempotencyKey(request: Request): string {
  const key = readCapturedRequest(request).headers['idempotency-key'];
  if (typeof key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(key))
    throw new BadRequestException();
  return key;
}
export function conversationPage(request: Request, allowPagination = true): ConversationPageDto {
  const captured = readCapturedRequest(request);
  if (captured.body.length || captured.headers['idempotency-key'] !== undefined)
    throw new BadRequestException();
  const query = new URLSearchParams(captured.target.split('?')[1] ?? '');
  const values: Record<string, unknown> = {};
  for (const [key, value] of query) {
    if (!allowPagination || !['limit', 'cursor'].includes(key) || Object.hasOwn(values, key))
      throw new BadRequestException();
    if (key === 'limit' && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(value))
      throw new BadRequestException();
    values[key] = key === 'limit' ? Number(value) : value;
  }
  const dto = plainToInstance(ConversationPageDto, values);
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
    throw new BadRequestException();
  return dto;
}
export function noConversationQuery(request: Request): void {
  if (readCapturedRequest(request).target.includes('?')) throw new BadRequestException();
}

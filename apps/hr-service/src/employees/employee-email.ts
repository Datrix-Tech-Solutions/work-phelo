import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';

export function normalizeEmployeeEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(
      'Employee email must be a valid email address.',
    );
  }
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (!isEmail(email)) {
    throw new BadRequestException(
      'Employee email must be a valid email address.',
    );
  }
  return email;
}

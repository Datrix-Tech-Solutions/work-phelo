import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessReinsuranceAccountingOutboxDto {
  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ReconcileDebitNoteAccountingEventsDto extends ProcessReinsuranceAccountingOutboxDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'When true, reports missing outbox rows without enqueueing them.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  dryRun?: boolean = true;
}

export class ReconcilePaymentAccountingEventsDto extends ReconcileDebitNoteAccountingEventsDto {}

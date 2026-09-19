import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  BudgetPeriod,
  BudgetScope,
  BudgetStatus,
} from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BudgetLineDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Active, leaf, posting-enabled expense or revenue account matching the budget scope.',
  })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Active cost centre this target applies to. Omit or null for a company-wide line covering ' +
      'the account across all cost centres. An account is either one company-wide line or ' +
      'split across cost centres, never both.',
  })
  @IsOptional()
  @IsUUID()
  costCentreId?: string | null;

  @ApiProperty({ example: 50000, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  amount!: number;
}

export class CreateBudgetDto {
  @ApiProperty({ example: 'FY2026 Operating Budget', maxLength: 120 })
  @Transform(trimmed)
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ enum: BudgetPeriod })
  @IsEnum(BudgetPeriod)
  period!: BudgetPeriod;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-01-01',
    description:
      'First day the budget takes effect. The end date is derived: start + one period − 1 day.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;

  @ApiProperty({ enum: BudgetScope })
  @IsEnum(BudgetScope)
  scope!: BudgetScope;

  @ApiProperty({ type: [BudgetLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BudgetLineDto)
  lines!: BudgetLineDto[];
}

/** Any subset of the create fields; `lines`, when sent, replaces the budget's lines entirely. */
export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}

export class QueryBudgetsDto {
  @ApiPropertyOptional({ enum: BudgetStatus })
  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive match on the name.' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  search?: string;
}

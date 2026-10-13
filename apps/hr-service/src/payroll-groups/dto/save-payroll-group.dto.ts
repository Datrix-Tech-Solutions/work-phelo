import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  MAX_PAYDAY_DAY,
  MAX_REMINDER_DAYS,
  PAYDAY_KINDS,
  PAY_FREQUENCIES,
  type PayFrequencyKey,
  type PaydayKindKey,
} from '../payroll-groups.constants';

export class PaydayDto {
  @ApiProperty({ enum: PAYDAY_KINDS })
  @IsIn(PAYDAY_KINDS)
  kind!: PaydayKindKey;

  @ApiProperty({
    required: false,
    description: `Day of the month, 1 to ${MAX_PAYDAY_DAY}. Only for kind "day_of_month".`,
  })
  @ValidateIf((o: PaydayDto) => o.kind === 'day_of_month')
  @IsInt()
  @Min(1)
  @Max(MAX_PAYDAY_DAY)
  day?: number;
}

export class ReminderDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    description:
      'How many days before payday to remind the people who run payroll.',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_REMINDER_DAYS)
  daysBefore!: number;
}

export class SavePayrollGroupDto {
  @ApiProperty({ example: 'Regular employees' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    enum: PAY_FREQUENCIES,
    description:
      'How often the group is paid. Only monthly is calculated so far.',
  })
  @IsIn(PAY_FREQUENCIES)
  frequency!: PayFrequencyKey;

  @ApiProperty({ type: PaydayDto })
  @ValidateNested()
  @Type(() => PaydayDto)
  payday!: PaydayDto;

  @ApiProperty({
    format: 'uuid',
    description: 'The payroll configuration the group uses.',
  })
  @IsUUID()
  configurationId!: string;

  @ApiProperty({ type: ReminderDto })
  @ValidateNested()
  @Type(() => ReminderDto)
  reminder!: ReminderDto;
}

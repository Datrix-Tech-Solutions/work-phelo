import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class StartTimerDto {
  @ApiPropertyOptional({
    description: "Pause the caller's other running timers first",
  })
  @IsOptional()
  @IsBoolean()
  pauseOthers?: boolean;
}

/** Time typed in by hand, in hours and minutes. */
export class TimeAmountDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  @Max(1000)
  hours!: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  @Max(59)
  minutes!: number;

  @ApiPropertyOptional({
    example: '2026-12-03',
    description: 'The day the time was worked; left out, it is not recorded',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

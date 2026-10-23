import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_FOLLOW_UP_DELAY_DAYS = 7;
export const MAX_FOLLOW_UP_DELAY_DAYS = 365;

export class UpdateCrmPreferencesDto {
  @ApiProperty({
    example: 7,
    minimum: 1,
    maximum: MAX_FOLLOW_UP_DELAY_DAYS,
    description:
      "Days after a prospect's latest interaction that its automatic follow-up falls due.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_FOLLOW_UP_DELAY_DAYS)
  followUpDelayDays!: number;
}

export class CrmPreferencesResponseDto {
  @ApiProperty({ example: 7 })
  followUpDelayDays!: number;
}

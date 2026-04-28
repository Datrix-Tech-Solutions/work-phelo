import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateAppraisalSettingsDto {
  @ApiProperty({ description: 'Outstanding threshold percentage', default: 90 })
  @IsInt()
  @Min(0)
  @Max(100)
  outstandingThreshold!: number;

  @ApiProperty({ description: 'Very Good threshold percentage', default: 80 })
  @IsInt()
  @Min(0)
  @Max(100)
  veryGoodThreshold!: number;

  @ApiProperty({ description: 'Good threshold percentage', default: 70 })
  @IsInt()
  @Min(0)
  @Max(100)
  goodThreshold!: number;

  @ApiProperty({
    description: 'Satisfactory threshold percentage',
    default: 60,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  satisfactoryThreshold!: number;
}

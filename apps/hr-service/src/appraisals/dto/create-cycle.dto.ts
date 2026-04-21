import { IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppraisalCycleDto {
  @ApiProperty({
    description: 'Cycle title',
    example: 'Midyear Performance Review',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    description: 'Optional cycle description',
    example: 'Review employee goals and performance for H1',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cycle start date', example: '2026-07-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Cycle end date', example: '2026-07-31' })
  @IsDateString()
  endDate!: string;
}

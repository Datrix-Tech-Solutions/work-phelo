import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitReviewDto {
  @ApiProperty({
    description: 'Review score from 1 to 5',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional({
    description: 'Optional comment for the review',
    example: 'Demonstrated strong collaboration and delivery',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

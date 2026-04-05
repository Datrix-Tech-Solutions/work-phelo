import { IsString, IsInt, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveTypeDto {
  @ApiProperty({
    description: 'Name of the leave type',
    example: 'Annual Leave',
  })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Allowed number of days per year', example: 21 })
  @IsInt()
  @Min(1)
  daysAllowed!: number;

  @ApiPropertyOptional({
    description: 'Whether unused days can carry over',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isCarryOver?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of carry-over days',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  maxCarryOverDays?: number;

  @ApiPropertyOptional({
    description: 'Requires manager approval before grant',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this leave type is paid',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

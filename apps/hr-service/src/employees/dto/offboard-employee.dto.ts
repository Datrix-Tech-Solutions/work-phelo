import { IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OffboardEmployeeDto {
  @ApiProperty({
    description: 'Effective offboarding date',
    example: '2026-05-31',
  })
  @IsDateString()
  offboardedAt!: string;

  @ApiProperty({
    description: 'Reason for offboarding',
    example: 'Contract ended',
  })
  @IsString()
  reason!: string;
}

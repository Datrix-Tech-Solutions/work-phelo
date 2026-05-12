import { IsString, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveRequestDto {
  @ApiProperty({ description: 'Leave type ID', example: 'leave-type-123' })
  @IsString()
  leaveTypeId!: string;

  @ApiProperty({ description: 'Leave start date', example: '2026-06-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'Leave end date', example: '2026-06-05' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    description: 'Optional leave reason',
    example: 'Annual vacation',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Optional supporting document name. Some leave types require this document before the request can be approved.',
    example: 'Medical Report - May 2026',
  })
  @IsOptional()
  @IsString()
  supportingDocumentName?: string;

  @ApiPropertyOptional({
    description:
      'Optional supporting document URL. Some leave types require this document before the request can be approved.',
    example: 'https://storage.example.com/leave-docs/medical-report-123.pdf',
  })
  @IsOptional()
  @IsString()
  supportingDocumentUrl?: string;
}

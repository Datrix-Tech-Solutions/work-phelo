import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../../prisma/generated/client';

export class CreateEmployeeDocumentDto {
  @ApiProperty({ enum: DocumentType, example: DocumentType.CONTRACT })
  @IsEnum(DocumentType)
  type!: DocumentType;

  @ApiPropertyOptional({
    description: 'Free-text label for the document when type is OTHER',
    example: 'Reference Letter',
  })
  @ValidateIf((dto) => dto.type === DocumentType.OTHER)
  @IsString()
  @MinLength(1)
  customType?: string;

  @ApiPropertyOptional({
    description: 'When this document expires, if applicable',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

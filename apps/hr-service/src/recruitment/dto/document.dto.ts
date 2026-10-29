import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, IsEnum } from 'class-validator';
import { RecruitmentDocumentType } from '../../../prisma/generated/client';

export class UploadRecruitmentDocumentDto {
  @ApiProperty({ enum: RecruitmentDocumentType })
  @IsEnum(RecruitmentDocumentType)
  type!: RecruitmentDocumentType;
}

export class CoverLetterTextDto {
  @ApiProperty({ maxLength: 10000, description: 'Typed cover letter' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text!: string;
}

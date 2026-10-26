import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RecruitmentDocumentType } from '../../../prisma/generated/client';

export class UploadRecruitmentDocumentDto {
  @ApiProperty({ enum: RecruitmentDocumentType })
  @IsEnum(RecruitmentDocumentType)
  type!: RecruitmentDocumentType;
}

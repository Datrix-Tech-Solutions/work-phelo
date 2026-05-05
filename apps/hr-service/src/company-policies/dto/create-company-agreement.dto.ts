import { ApiProperty } from '@nestjs/swagger';
import { CompanyAgreementType } from '../../../prisma/generated/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class CreateCompanyAgreementDto {
  @ApiProperty({
    enum: CompanyAgreementType,
    example: CompanyAgreementType.NDA,
  })
  @IsEnum(CompanyAgreementType)
  type!: CompanyAgreementType;

  @ApiProperty({
    example: 'Employee Non-Disclosure Agreement 2026',
    maxLength: 160,
  })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    example:
      'This agreement covers confidentiality obligations and handling of internal information.',
  })
  @IsString()
  details!: string;
}

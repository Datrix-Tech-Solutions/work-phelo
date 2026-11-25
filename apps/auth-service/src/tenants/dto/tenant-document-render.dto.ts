import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { TenantDocumentTemplateResponseDto } from './tenant-document-template.dto';

export class TenantDocumentRenderTemplateDto extends PickType(
  TenantDocumentTemplateResponseDto,
  ['config', 'version', 'defaultsApplied', 'watermarkUrl'] as const,
) {}

export class TenantDocumentRenderProfileDto {
  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  legalName!: string;

  @ApiPropertyOptional({ nullable: true })
  registrationNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  physicalAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  signatureUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  authorizedSignatoryName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  authorizedSignatoryTitle!: string | null;
}

export class TenantDocumentRenderResponseDto {
  @ApiProperty({ type: TenantDocumentRenderTemplateDto })
  template!: TenantDocumentRenderTemplateDto;

  @ApiProperty({ type: TenantDocumentRenderProfileDto })
  profile!: TenantDocumentRenderProfileDto;
}

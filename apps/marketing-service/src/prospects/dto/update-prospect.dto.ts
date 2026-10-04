import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CollapseWhitespaceString,
  OptionalCollapseWhitespaceString,
} from '../../crm-settings/dto/string.transforms';

export class UpdateProspectPrimaryContactDto {
  @ApiPropertyOptional({ example: 'Ama Mensah', maxLength: 160 })
  @CollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: '+233201234567', maxLength: 40 })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'ama.mensah@example.com', maxLength: 254 })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings decision-maker type ID.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  decisionMakerTypeId?: string | null;
}

export class UpdateProspectProductDto {
  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description:
      'Existing prospect product association ID. Omit to add a new product/service association.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings product/service option ID.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 10000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedValue?: number;

  @ApiPropertyOptional({ example: 2500, minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  achievedValue?: number | null;

  @ApiPropertyOptional({
    example: 10,
    nullable: true,
    description:
      'Commission rate captured from the user. The calculation rule is a pending product decision.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  commissionRate?: number | null;

  @ApiPropertyOptional({ example: 1000, minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionAmount?: number | null;

  @ApiPropertyOptional({ example: '2026-10-31', nullable: true })
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string | null;
}

export class UpdateProspectLocationDto {
  @ApiPropertyOptional({ example: 'Accra, Ghana', maxLength: 500 })
  @CollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  label?: string;

  @ApiPropertyOptional({ example: 5.6037, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -0.187, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class UpdateProspectDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'User to assign it to. Choosing someone else needs the assign permission.',
  })
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
  @ApiPropertyOptional({ example: 'Acme Manufacturing Ltd', maxLength: 200 })
  @CollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings prospect business type ID.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  businessTypeId?: string | null;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings source type ID.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  sourceTypeId?: string | null;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'Required active sales pipeline stage ID.',
  })
  @IsOptional()
  @IsUUID()
  pipelineStageId?: string;

  @ApiPropertyOptional({ type: UpdateProspectPrimaryContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProspectPrimaryContactDto)
  primaryContact?: UpdateProspectPrimaryContactDto;

  @ApiPropertyOptional({
    type: [UpdateProspectProductDto],
    description:
      'Complete desired product/service association set. Existing rows are updated by ID; rows without ID are added; omitted existing rows are removed.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateProspectProductDto)
  products?: UpdateProspectProductDto[];

  @ApiPropertyOptional({ type: UpdateProspectLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProspectLocationDto)
  location?: UpdateProspectLocationDto;
}

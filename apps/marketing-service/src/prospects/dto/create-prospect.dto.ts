import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNotEmptyObject,
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
import { ProspectInteractionParticipantDto } from './create-prospect-interaction.dto';

export class CreateProspectContactDto {
  @ApiProperty({ example: 'Ama Mensah', maxLength: 160 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

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
  })
  @IsOptional()
  @IsUUID()
  decisionMakerTypeId?: string;
}

export class CreateProspectProductDto {
  @ApiProperty({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings product/service option ID.',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 10000, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedValue!: number;

  @ApiPropertyOptional({ example: 2500, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  achievedValue?: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Commission rate captured from the user. The calculation rule is a pending product decision.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  commissionRate?: number;

  @ApiPropertyOptional({ example: 1000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionAmount?: number;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}

export class CreateProspectLocationDto {
  @ApiProperty({ example: 'Accra, Ghana', maxLength: 500 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  label!: string;

  @ApiProperty({ example: 5.6037, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -0.187, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class CreateProspectInitialInteractionDto {
  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings interaction medium ID.',
  })
  @IsOptional()
  @IsUUID()
  interactionMediumId?: string;

  @ApiProperty({ example: '2026-09-28' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({ example: 'Initial discovery call.', maxLength: 1000 })
  @OptionalCollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the initial interaction involved a decision maker.',
  })
  @IsOptional()
  @IsBoolean()
  decisionMakerInvolved?: boolean;

  @ApiPropertyOptional({ type: [ProspectInteractionParticipantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProspectInteractionParticipantDto)
  participants?: ProspectInteractionParticipantDto[];
}

export class CreateProspectDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'User to assign it to. Defaults to the creator; choosing someone else needs the assign permission.',
  })
  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @ApiProperty({ example: 'Acme Manufacturing Ltd', maxLength: 200 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName!: string;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings prospect business type ID.',
  })
  @IsOptional()
  @IsUUID()
  businessTypeId?: string;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings source type ID.',
  })
  @IsOptional()
  @IsUUID()
  sourceTypeId?: string;

  @ApiProperty({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'Required active sales pipeline stage ID.',
  })
  @IsUUID()
  pipelineStageId!: string;

  @ApiProperty({ type: CreateProspectContactDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateProspectContactDto)
  primaryContact!: CreateProspectContactDto;

  @ApiProperty({ type: [CreateProspectProductDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProspectProductDto)
  products!: CreateProspectProductDto[];

  @ApiProperty({ type: CreateProspectLocationDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateProspectLocationDto)
  location!: CreateProspectLocationDto;

  @ApiPropertyOptional({ type: CreateProspectInitialInteractionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProspectInitialInteractionDto)
  initialInteraction?: CreateProspectInitialInteractionDto;
}

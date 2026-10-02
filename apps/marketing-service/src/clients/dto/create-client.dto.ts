import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CollapseWhitespaceString } from '../../crm-settings/dto/string.transforms';
import {
  CreateProspectContactDto,
  CreateProspectLocationDto,
} from '../../prospects/dto/create-prospect.dto';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Manufacturing Ltd', maxLength: 200 })
  @CollapseWhitespaceString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName!: string;

  @ApiPropertyOptional({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings business type ID.',
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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiProperty({ type: CreateProspectContactDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateProspectContactDto)
  primaryContact!: CreateProspectContactDto;

  @ApiPropertyOptional({
    type: [String],
    description:
      'CRM Settings product/service IDs the client is linked to. Each starts as PENDING.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  productIds?: string[];

  @ApiProperty({ type: CreateProspectLocationDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateProspectLocationDto)
  location!: CreateProspectLocationDto;
}

export class ConvertProspectToClientDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Marks the new client as billable.',
  })
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;
}

export class AddClientProductDto {
  @ApiProperty({
    example: '5f01c5e7-4f1b-4e47-9b69-8ecf18bc6585',
    description: 'CRM Settings product/service option ID.',
  })
  @IsUUID()
  productId!: string;
}

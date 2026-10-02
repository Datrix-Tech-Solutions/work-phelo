import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CollapseWhitespaceString } from '../../crm-settings/dto/string.transforms';
import {
  UpdateProspectLocationDto,
  UpdateProspectPrimaryContactDto,
} from '../../prospects/dto/update-prospect.dto';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Acme Manufacturing Ltd', maxLength: 200 })
  @CollapseWhitespaceString()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  businessTypeId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  sourceTypeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiPropertyOptional({ type: UpdateProspectPrimaryContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProspectPrimaryContactDto)
  primaryContact?: UpdateProspectPrimaryContactDto;

  @ApiPropertyOptional({ type: UpdateProspectLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProspectLocationDto)
  location?: UpdateProspectLocationDto;
}

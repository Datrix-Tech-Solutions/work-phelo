import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDriverLicenceDto {
  @ApiProperty({ example: 'DL-0012345' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  licenceNumber!: string;

  @ApiProperty({ example: '2022-03-14', description: 'Date of issue' })
  @IsDateString()
  issuedAt!: string;

  @ApiProperty({ example: '2027-03-13', description: 'Date of expiry' })
  @IsDateString()
  expiresAt!: string;
}

export class UpdateDriverLicenceDto {
  @ApiPropertyOptional({ example: 'DL-0012345' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  licenceNumber?: string;

  @ApiPropertyOptional({ example: '2022-03-14' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({ example: '2027-03-13' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

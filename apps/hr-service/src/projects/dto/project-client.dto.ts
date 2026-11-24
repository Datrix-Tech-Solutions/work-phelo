import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const collapseWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class CreateProjectClientDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(collapseWhitespace)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

export class ListProjectClientsQueryDto {
  @ApiPropertyOptional({ description: 'Part of the name to look for' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * Derived officer status. BOOKED / ON_ROUTE come from approved trips; INACTIVE is
 * switched off on the officers page; LEFT means the employee is no longer in HR.
 */
export const OFFICER_STATUSES = [
  'AVAILABLE',
  'BOOKED',
  'ON_ROUTE',
  'INACTIVE',
  'LEFT',
] as const;
export type OfficerStatus = (typeof OFFICER_STATUSES)[number];
export const OFFICER_STATUS_FILTERS = OFFICER_STATUSES;

export class AddTransportOfficersDto {
  @ApiProperty({
    type: [String],
    description: 'HR employee IDs to add as transport officers.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  employeeIds!: string[];
}

export class QueryTransportOfficersDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 12, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Matches name, job title or department.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: OFFICER_STATUS_FILTERS })
  @IsOptional()
  @IsIn(OFFICER_STATUS_FILTERS)
  status?: OfficerStatus;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BusinessClassFieldSection,
  BusinessClassFieldType,
} from '../../../prisma/generated/client';

export class BusinessClassFieldResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  businessClassId!: string;

  @ApiProperty({ enum: BusinessClassFieldSection })
  section!: BusinessClassFieldSection;

  @ApiProperty({ example: 'vehicle_make' })
  fieldKey!: string;

  @ApiProperty({ example: 'Vehicle Make' })
  label!: string;

  @ApiProperty({ enum: BusinessClassFieldType })
  fieldType!: BusinessClassFieldType;

  @ApiProperty({ example: false })
  required!: boolean;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['Toyota', 'Honda'],
  })
  options!: string[] | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  validationRules!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'e.g. Toyota' })
  placeholder!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Enter the vehicle make.',
  })
  helpText!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class BusinessClassResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'Motor' })
  name!: string;

  @ApiProperty({ example: 'MOTOR' })
  code!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Motor vehicle insurance class of business.',
  })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 0 })
  displayOrder!: number;

  @ApiProperty({ type: [BusinessClassFieldResponseDto] })
  fields!: BusinessClassFieldResponseDto[];

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ format: 'uuid' })
  updatedByUserId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class BusinessClassesPageMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ example: 5, minimum: 0 })
  total!: number;

  @ApiProperty({ example: 1, minimum: 0 })
  totalPages!: number;
}

export class PaginatedBusinessClassesResponseDto {
  @ApiProperty({ type: [BusinessClassResponseDto] })
  items!: BusinessClassResponseDto[];

  @ApiProperty({ type: BusinessClassesPageMetaDto })
  meta!: BusinessClassesPageMetaDto;
}

export class BusinessClassFormSchemaFieldDto {
  @ApiProperty({ example: 'vehicle_make' })
  fieldKey!: string;

  @ApiProperty({ example: 'Vehicle Make' })
  label!: string;

  @ApiProperty({ enum: BusinessClassFieldType })
  fieldType!: BusinessClassFieldType;

  @ApiProperty({ example: false })
  required!: boolean;

  @ApiPropertyOptional({ type: [String], nullable: true })
  options!: string[] | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  validationRules!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  placeholder!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  helpText!: string | null;

  @ApiProperty({ example: 0 })
  displayOrder!: number;
}

export class BusinessClassFormSchemaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Motor' })
  name!: string;

  @ApiProperty({ example: 'MOTOR' })
  code!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [BusinessClassFormSchemaFieldDto] })
  businessDetails!: BusinessClassFormSchemaFieldDto[];

  @ApiProperty({ type: [BusinessClassFormSchemaFieldDto] })
  offerDetails!: BusinessClassFormSchemaFieldDto[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'Business class not found' },
      { type: 'array', items: { type: 'string' } },
    ],
  })
  message!: string | string[];
}

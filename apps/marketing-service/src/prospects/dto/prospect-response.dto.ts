import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProspectContactResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  decisionMakerTypeId!: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

export class ProspectProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  expectedValue!: unknown;

  @ApiPropertyOptional({ nullable: true })
  achievedValue!: unknown;

  @ApiPropertyOptional({ nullable: true })
  commissionRate!: unknown;

  @ApiPropertyOptional({ nullable: true })
  commissionAmount!: unknown;

  @ApiPropertyOptional({ nullable: true })
  expectedCloseDate!: Date | null;
}

export class ProspectInteractionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  interactionMediumId!: string | null;

  @ApiProperty()
  occurredAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;
}

export class ProspectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  companyName!: string;

  @ApiPropertyOptional({ nullable: true })
  businessTypeId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceTypeId!: string | null;

  @ApiProperty()
  pipelineStageId!: string;

  @ApiProperty()
  assignedUserId!: string;

  @ApiProperty()
  locationLabel!: string;

  @ApiProperty()
  latitude!: unknown;

  @ApiProperty()
  longitude!: unknown;

  @ApiProperty({ type: [ProspectContactResponseDto] })
  contacts!: ProspectContactResponseDto[];

  @ApiProperty({ type: [ProspectProductResponseDto] })
  products!: ProspectProductResponseDto[];

  @ApiProperty({ type: [ProspectInteractionResponseDto] })
  interactions!: ProspectInteractionResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ProspectReferenceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ProspectDetailContactDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiPropertyOptional({ nullable: true, type: ProspectReferenceDto })
  decisionMaker!: ProspectReferenceDto | null;
}

export class ProspectDetailProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: ProspectReferenceDto })
  product!: ProspectReferenceDto;

  @ApiProperty({ example: '10000.00' })
  expectedValue!: string;

  @ApiPropertyOptional({ nullable: true, example: '2500.00' })
  achievedValue!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '10' })
  commissionRate!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1000.00' })
  commissionAmount!: string | null;

  @ApiPropertyOptional({ nullable: true })
  expectedCloseDate!: Date | null;
}

export class ProspectLocationDto {
  @ApiProperty()
  label!: string;

  @ApiProperty({ example: '5.603700' })
  latitude!: string;

  @ApiProperty({ example: '-0.187000' })
  longitude!: string;
}

export class ProspectDetailSalesStageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  probability!: number;

  @ApiProperty()
  displayOrder!: number;
}

export class ProspectDetailInteractionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  occurredAt!: Date;

  @ApiPropertyOptional({ nullable: true, type: ProspectReferenceDto })
  interactionMedium!: ProspectReferenceDto | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdByUserId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ProspectDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyName!: string;

  @ApiPropertyOptional({ nullable: true, type: ProspectReferenceDto })
  businessType!: ProspectReferenceDto | null;

  @ApiPropertyOptional({ nullable: true, type: ProspectReferenceDto })
  sourceType!: ProspectReferenceDto | null;

  @ApiProperty()
  assignedUserId!: string;

  @ApiProperty({ type: ProspectLocationDto })
  location!: ProspectLocationDto;

  @ApiProperty({ type: ProspectDetailSalesStageDto })
  salesStage!: ProspectDetailSalesStageDto;

  @ApiProperty({
    description:
      'Currently mirrors the configured sales-stage probability; no separate progress model exists yet.',
  })
  progress!: number;

  @ApiProperty({ type: [ProspectDetailContactDto] })
  contacts!: ProspectDetailContactDto[];

  @ApiProperty({ type: [ProspectDetailProductDto] })
  products!: ProspectDetailProductDto[];

  @ApiProperty({ example: '10000.00' })
  totalExpectedValue!: string;

  @ApiProperty({ example: '2500.00' })
  totalAchievedValue!: string;

  @ApiProperty({ type: [ProspectDetailInteractionDto] })
  interactions!: ProspectDetailInteractionDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

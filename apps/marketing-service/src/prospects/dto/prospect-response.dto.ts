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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProspectDetailContactDto,
  ProspectDetailInteractionDto,
  ProspectLocationDto,
  ProspectReferenceDto,
} from '../../prospects/dto/prospect-response.dto';

export class ClientDetailProductDto {
  @ApiProperty({ description: 'Client product association ID.' })
  id!: string;

  @ApiProperty({ type: ProspectReferenceDto })
  product!: ProspectReferenceDto;

  @ApiProperty({ enum: ['PENDING', 'PURCHASED', 'UNINTERESTED'] })
  status!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '10000.00',
    description:
      'Carried over from the prospect product at conversion; null for products added directly.',
  })
  expectedValue!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '10' })
  commissionRate!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '1000.00',
    description: 'Commission on the expected value.',
  })
  commissionAmount!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ClientDetailResponseDto {
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

  @ApiProperty()
  isBillable!: boolean;

  @ApiProperty({
    description:
      'True once the client has its entity in Accounting (its first transaction was sent).',
  })
  hasAccountingEntity!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The entity type the client's Accounting entity was created under. Fixed after the first transaction.",
  })
  accountingEntityTypeId!: string | null;

  @ApiProperty({ type: ProspectLocationDto })
  location!: ProspectLocationDto;

  @ApiProperty({ type: [ProspectDetailContactDto] })
  contacts!: ProspectDetailContactDto[];

  @ApiProperty({ type: [ClientDetailProductDto] })
  products!: ClientDetailProductDto[];

  @ApiProperty({
    type: [ProspectDetailInteractionDto],
    description:
      'Interaction history, including interactions recorded while the client was a prospect.',
  })
  interactions!: ProspectDetailInteractionDto[];

  @ApiPropertyOptional({ nullable: true })
  convertedFromProspectId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  convertedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

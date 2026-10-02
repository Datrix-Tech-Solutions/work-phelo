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

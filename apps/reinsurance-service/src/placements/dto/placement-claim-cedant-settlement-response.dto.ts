import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementClaimCedantSettlementStatus } from '../../../prisma/generated/client';

export class PlacementClaimCedantSettlementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, example: '25000.00' })
  amount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  settlementDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    enum: PlacementClaimCedantSettlementStatus,
    example: PlacementClaimCedantSettlementStatus.RECORDED,
  })
  status!: PlacementClaimCedantSettlementStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reversalOfSettlementId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlacementClaimCedantSettlementListResponseDto {
  @ApiProperty({ type: [PlacementClaimCedantSettlementResponseDto] })
  items!: PlacementClaimCedantSettlementResponseDto[];
}

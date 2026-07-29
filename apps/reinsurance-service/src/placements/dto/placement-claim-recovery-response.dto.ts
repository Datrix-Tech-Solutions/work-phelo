import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CounterpartyType,
  PlacementClaimCashCallStatus,
  PlacementClaimRecoveryReceiptStatus,
} from '../../../prisma/generated/client';

export class PlacementClaimRecoveryCounterpartyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.REINSURER })
  type!: CounterpartyType;

  @ApiProperty({ example: 'Avenue Re' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  registrationNumber!: string | null;
}

export class PlacementClaimRecoveryReceiptResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  allocationId!: string;

  @ApiProperty({ format: 'uuid' })
  cashCallId!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  amount!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  paymentDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    enum: PlacementClaimRecoveryReceiptStatus,
    example: PlacementClaimRecoveryReceiptStatus.RECORDED,
  })
  status!: PlacementClaimRecoveryReceiptStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reversalOfReceiptId!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: PlacementClaimRecoveryCounterpartyDto })
  counterparty!: PlacementClaimRecoveryCounterpartyDto;
}

export class PlacementClaimRecoveryReceiptListResponseDto {
  @ApiProperty({ type: [PlacementClaimRecoveryReceiptResponseDto] })
  items!: PlacementClaimRecoveryReceiptResponseDto[];
}

export class PlacementClaimRecoveryPositionCashCallDto {
  @ApiProperty({ format: 'uuid' })
  cashCallId!: string;

  @ApiProperty({ format: 'uuid' })
  allocationId!: string;

  @ApiProperty({ format: 'uuid' })
  counterpartyId!: string;

  @ApiProperty({ type: PlacementClaimRecoveryCounterpartyDto })
  counterparty!: PlacementClaimRecoveryCounterpartyDto;

  @ApiProperty({ example: 'CCL-001' })
  cashCallNumber!: string;

  @ApiProperty({ enum: PlacementClaimCashCallStatus })
  cashCallStatus!: PlacementClaimCashCallStatus;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: String, example: '100000.00' })
  calledAmount!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  recoveredAmount!: string;

  @ApiProperty({ type: String, example: '10000.00' })
  reversedAmount!: string;

  @ApiProperty({ type: String, example: '60000.00' })
  outstandingAmount!: string;

  @ApiProperty({
    enum: ['UNRECOVERED', 'PARTIALLY_RECOVERED', 'FULLY_RECOVERED'],
    example: 'PARTIALLY_RECOVERED',
  })
  recoveryStatus!: 'UNRECOVERED' | 'PARTIALLY_RECOVERED' | 'FULLY_RECOVERED';

  @ApiProperty({ type: [PlacementClaimRecoveryReceiptResponseDto] })
  receipts!: PlacementClaimRecoveryReceiptResponseDto[];
}

export class PlacementClaimRecoveryPositionTotalsDto {
  @ApiProperty({ type: String, example: '100000.00' })
  totalAllocated!: string;

  @ApiProperty({ type: String, example: '100000.00' })
  totalCashCalled!: string;

  @ApiProperty({ type: String, example: '40000.00' })
  totalRecovered!: string;

  @ApiProperty({ type: String, example: '10000.00' })
  totalReversed!: string;

  @ApiProperty({ type: String, example: '60000.00' })
  totalOutstanding!: string;
}

export class PlacementClaimRecoveryPositionResponseDto {
  @ApiProperty({ format: 'uuid' })
  claimId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({ example: 'GHS' })
  currency!: string;

  @ApiProperty({ type: PlacementClaimRecoveryPositionTotalsDto })
  recoveries!: PlacementClaimRecoveryPositionTotalsDto;

  @ApiProperty({ type: [PlacementClaimRecoveryPositionCashCallDto] })
  perCashCall!: PlacementClaimRecoveryPositionCashCallDto[];

  @ApiProperty({
    example:
      'Cedant claim settlement is deferred pending approval of the settlement basis.',
  })
  cedantSettlementStatus!: string;
}

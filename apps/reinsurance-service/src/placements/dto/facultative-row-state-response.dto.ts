import { ApiProperty } from '@nestjs/swagger';

export const FACULTATIVE_ROW_PAYMENT_STATUSES = [
  'Outstanding',
  'Pending',
  'Part Payment',
  'Paid',
] as const;

export type FacultativeRowPaymentStatus =
  (typeof FACULTATIVE_ROW_PAYMENT_STATUSES)[number];

export class FacultativeRowStateDto {
  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiProperty({
    enum: FACULTATIVE_ROW_PAYMENT_STATUSES,
    example: 'Pending',
  })
  paymentStatus!: FacultativeRowPaymentStatus;

  @ApiProperty({
    example: true,
    description:
      'Preserves current Facultative Open-table behavior: true when any placement payment is RECORDED.',
  })
  hasRecordedPayment!: boolean;

  @ApiProperty({ example: 1 })
  nonVoidEndorsementCount!: number;

  @ApiProperty({ example: true })
  hasNonVoidEndorsement!: boolean;
}

export class FacultativeRowStateResponseDto {
  @ApiProperty({ type: [FacultativeRowStateDto] })
  items!: FacultativeRowStateDto[];
}

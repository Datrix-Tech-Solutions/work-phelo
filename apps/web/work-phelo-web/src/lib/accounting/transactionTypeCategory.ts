import type { TypeChipColor } from '@/components/atoms/TypeChip';
import { TransactionTypeCategory } from '@/types/accounting';

export const TRANSACTION_TYPE_CATEGORY_LABEL: Record<TransactionTypeCategory, string> = {
  NEUTRAL: 'Neutral',
  RECEIVABLE: 'Receivable',
  PAYABLE: 'Payable',
  NONE: 'None',
};

export const TRANSACTION_TYPE_CATEGORY_CHIP_COLOR: Record<TransactionTypeCategory, TypeChipColor> =
  {
    NEUTRAL: 'blue',
    RECEIVABLE: 'green',
    PAYABLE: 'red',
    NONE: 'gray',
  };
